use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::process::Command as StdCommand;
use std::sync::mpsc;
use tauri::Manager;
use tiny_http;

mod dropbox;

#[derive(Debug, Deserialize)]
struct DropboxApiFile {
    pub name: String,
    pub path_lower: String,
    #[serde(rename = ".tag")]
    pub tag: String,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct DropboxFile {
    pub name: String,
    pub path_lower: String,
    pub tag: String,
    pub size: Option<u64>,
}

impl From<DropboxApiFile> for DropboxFile {
    fn from(f: DropboxApiFile) -> Self {
        Self { name: f.name, path_lower: f.path_lower, tag: f.tag, size: f.size }
    }
}

#[derive(Debug, Deserialize)]
struct DropboxApiListResult {
    pub entries: Vec<DropboxApiFile>,
    pub cursor: Option<String>,
    pub has_more: bool,
}

impl From<DropboxApiListResult> for DropboxListResult {
    fn from(r: DropboxApiListResult) -> Self {
        Self { entries: r.entries.into_iter().map(Into::into).collect(), cursor: r.cursor, has_more: r.has_more }
    }
}

#[derive(Debug, Serialize)]
pub struct DropboxListResult {
    pub entries: Vec<DropboxFile>,
    pub cursor: Option<String>,
    pub has_more: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TemporaryLinkResult {
    pub link: String,
}

// -- OAuth types --

#[derive(Debug, Serialize, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    #[serde(rename = "token_type")]
    _token_type: String,
    #[serde(rename = "uid")]
    _uid: Option<String>,
    #[serde(rename = "account_id")]
    _account_id: Option<String>,
}

const OAUTH_PORT: u16 = 4989;
const REDIRECT_URI: &str = "http://127.0.0.1:4989/callback";
const TOKEN_FILE: &str = "excubia_tokens.json";

fn get_token_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    let mut path = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    std::fs::create_dir_all(&path).ok();
    path.push(TOKEN_FILE);
    path
}

fn load_stored_token(app: &tauri::AppHandle) -> Option<String> {
    let path = get_token_path(app);
    let data = std::fs::read_to_string(path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&data).ok()?;

    // Check 7-day inactivity window
    let saved_at = parsed["saved_at"].as_u64().unwrap_or(0);
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
    let seven_days: u64 = 7 * 24 * 60 * 60;
    if now > saved_at + seven_days {
        return None; // Re-login required
    }

    // Try refreshing if we have a refresh token
    if let Some(refresh_token) = parsed["refresh_token"].as_str() {
        let client = reqwest::blocking::Client::new();
        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", DROPBOX_APP_KEY),
        ];
        if let Ok(resp) = client.post("https://api.dropboxapi.com/oauth2/token").form(&params).send() {
            if resp.status().is_success() {
                if let Ok(token_data) = resp.json::<serde_json::Value>() {
                    if let Some(new_access) = token_data["access_token"].as_str() {
                        // Save new token (preserve saved_at)
                        save_tokens(app, new_access, Some(refresh_token));
                        return Some(new_access.to_string());
                    }
                }
            }
        }
        // Refresh failed but we're within 7 days — try the old token
        parsed["access_token"].as_str().map(String::from)
    } else {
        parsed["access_token"].as_str().map(String::from)
    }
}

fn save_tokens(app: &tauri::AppHandle, access: &str, refresh: Option<&str>) {
    let path = get_token_path(app);
    let mut map = serde_json::Map::new();
    map.insert("access_token".into(), serde_json::Value::String(access.into()));
    if let Some(r) = refresh {
        map.insert("refresh_token".into(), serde_json::Value::String(r.into()));
    }
    map.insert("saved_at".into(), serde_json::Value::Number(serde_json::Number::from(
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()
    )));
    if let Ok(json) = serde_json::to_string(&map) {
        std::fs::write(path, json).ok();
    }
}

#[tauri::command]
async fn start_oauth(app: tauri::AppHandle) -> Result<String, String> {
    let app_key = DROPBOX_APP_KEY;
    if app_key.is_empty() {
        return Err("Dropbox App Key not configured. Set the DROPBOX_APP_KEY environment variable or embed it in the code.".into());
    }

    // Generate PKCE code verifier (128 chars random)
    let code_verifier: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(128)
        .map(char::from)
        .collect();

    // Compute code challenge = base64url(sha256(code_verifier))
    let code_challenge = {
        let mut hasher = Sha256::new();
        hasher.update(code_verifier.as_bytes());
        let hash = hasher.finalize();
        URL_SAFE_NO_PAD.encode(hash)
    };

    let (tx, rx) = mpsc::channel();

    // Start local HTTP server on a background thread
    std::thread::spawn(move || {
        let addr = format!("127.0.0.1:{}", OAUTH_PORT);
        let server = match tiny_http::Server::http(&addr) {
            Ok(s) => s,
            Err(e) => {
                let _ = tx.send(Err(format!("Failed to start local server: {}", e)));
                return;
            }
        };
        // Accept exactly one request (the OAuth callback)
        if let Ok(mut request) = server.recv() {
            let url = request.url().to_string();
            let response = tiny_http::Response::from_string(
                "<html><body><h2>Authenticated!</h2><p>You can close this window and return to Excubia Player.</p></body></html>"
            ).with_status_code(200);
            let _ = request.respond(response);

            // Parse auth code from URL query
            let code = url::Url::parse(&format!("http://localhost{}", &url))
                .ok()
                .and_then(|u| {
                    u.query_pairs()
                        .find(|(k, _)| k == "code")
                        .map(|(_, v)| v.to_string())
                })
                .or_else(|| {
                    // Try to extract from fragment (some OAuth flows use #)
                    url.split('?').nth(1).and_then(|q| {
                        q.split('&').find_map(|p| {
                            let mut parts = p.splitn(2, '=');
                            if parts.next()? == "code" { parts.next().map(String::from) } else { None }
                        })
                    })
                })
                .unwrap_or_default();

            if code.is_empty() {
                let _ = tx.send(Err("No authorization code received from Dropbox".into()));
            } else {
                let _ = tx.send(Ok(code));
            }
        } else {
            let _ = tx.send(Err("Failed to receive OAuth callback".into()));
        }
    });

    // Open browser to Dropbox OAuth URL (PKCE flow — no client secret needed)
    let auth_url = format!(
        "https://www.dropbox.com/oauth2/authorize?client_id={}&response_type=code&redirect_uri={}&token_access_type=offline&code_challenge_method=S256&code_challenge={}",
        app_key, REDIRECT_URI, code_challenge
    );

    // Try to open browser, fallback to printing URL
    let opened = StdCommand::new("open").arg(&auth_url).spawn().is_ok()
        || StdCommand::new("xdg-open").arg(&auth_url).spawn().is_ok();

    if !opened {
        // For headless environments, return URL to the frontend
        return Err(format!("OPEN_BROWSER:{}", auth_url));
    }

    // Wait for the code from the HTTP server
    let code: Result<String, String> = rx.recv().map_err(|_| "OAuth process interrupted".to_string())?;
    let code = code?;

    // Exchange code for tokens (PKCE — verifier replaces client_secret)
    let client = reqwest::Client::new();
    let params = [
        ("code", code.as_str()),
        ("grant_type", "authorization_code"),
        ("client_id", app_key),
        ("code_verifier", &code_verifier),
        ("redirect_uri", REDIRECT_URI),
    ];

    let resp = client
        .post("https://api.dropboxapi.com/oauth2/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token exchange failed: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Token exchange error: {}", text));
    }

    let token_data: OAuthTokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    // Store tokens persistently
    save_tokens(
        &app,
        &token_data.access_token,
        token_data.refresh_token.as_deref(),
    );

    Ok(token_data.access_token)
}

#[tauri::command]
fn check_stored_token(app: tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(load_stored_token(&app))
}

#[tauri::command]
fn clear_stored_token(app: tauri::AppHandle) -> Result<(), String> {
    let path = get_token_path(&app);
    std::fs::remove_file(path).ok();
    Ok(())
}

#[tauri::command]
async fn dropbox_list_folder(
    access_token: String,
    path: String,
) -> Result<DropboxListResult, String> {
    dropbox::list_folder(&access_token, &path).await
}

#[tauri::command]
async fn dropbox_get_temporary_link(
    access_token: String,
    path: String,
) -> Result<TemporaryLinkResult, String> {
    dropbox::get_temporary_link(&access_token, &path).await
}

#[tauri::command]
async fn dropbox_search(
    access_token: String,
    query: String,
) -> Result<DropboxListResult, String> {
    dropbox::search(&access_token, &query).await
}

#[tauri::command]
fn launch_mpv(url: String) -> Result<(), String> {
    StdCommand::new("mpv")
        .arg("--no-terminal")
        .arg("--keep-open=yes")
        .arg(&url)
        .spawn()
        .map_err(|e| format!("Failed to launch mpv: {}. Is mpv installed? (brew install mpv)", e))?;
    Ok(())
}

// ============================================================
// TODO: Replace this with your own Dropbox App Key
// Get one at https://www.dropbox.com/developers/apps
// Create an app with "Full Dropbox" scope, then copy the App Key
// ============================================================
const DROPBOX_APP_KEY: &str = "YOUR_DROPBOX_APP_KEY";

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_oauth,
            check_stored_token,
            clear_stored_token,
            dropbox_list_folder,
            dropbox_get_temporary_link,
            dropbox_search,
            launch_mpv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
