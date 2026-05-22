use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::os::unix::net::UnixStream;
use std::process::Command as StdCommand;
use std::sync::mpsc;
use std::sync::Mutex;
use tauri::Manager;
use tiny_http;

mod dropbox;

const MPV_SOCKET: &str = "/tmp/excubia-mpv.socket";

fn find_mpv() -> Option<String> {
    let paths = ["/opt/homebrew/bin/mpv", "/usr/local/bin/mpv", "/usr/bin/mpv"];
    paths.iter().find(|p| std::path::Path::new(p).exists()).map(|s| s.to_string())
        .or_else(|| {
            // Fallback: try PATH
            let output = StdCommand::new("which").arg("mpv").output().ok()?;
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() && std::path::Path::new(&path).exists() { Some(path) } else { None }
        })
}

/// Send a JSON command to mpv via IPC socket. Fire-and-forget — no response.
fn mpv_send(json: &str) -> Result<(), String> {
    let mut socket = UnixStream::connect(MPV_SOCKET)
        .map_err(|e| format!("Cannot connect to mpv: {}", e))?;
    socket.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to send: {}", e))?;
    Ok(())
}

/// Send a command and read the JSON response. Retries on EAGAIN.
fn mpv_send_and_read(json: &str) -> Result<String, String> {
    let mut socket = UnixStream::connect(MPV_SOCKET)
        .map_err(|e| format!("Cannot connect to mpv: {}", e))?;
    socket.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to send: {}", e))?;
    // Give mpv a moment to respond, then try reading
    std::thread::sleep(std::time::Duration::from_millis(100));
    let mut buf = [0u8; 8192];
    let mut total = 0usize;
    socket.set_read_timeout(Some(std::time::Duration::from_millis(1500)))
        .ok();
    loop {
        match socket.read(&mut buf[total..]) {
            Ok(n) if n == 0 => break,
            Ok(n) => { total += n; break; }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock
                || e.kind() == std::io::ErrorKind::Interrupted => {
                std::thread::sleep(std::time::Duration::from_millis(20));
                continue;
            }
            Err(e) => return Err(format!("Read error: {}", e)),
        }
    }
    Ok(String::from_utf8_lossy(&buf[..total]).trim().to_string())
}

#[tauri::command]
fn start_mpv() -> Result<(), String> {
    let mpv = find_mpv().ok_or_else(|| "mpv not found. Install with: brew install mpv".to_string())?;
    let _ = std::fs::remove_file(MPV_SOCKET);
    if UnixStream::connect(MPV_SOCKET).is_ok() {
        return Ok(());
    }
    let socket_arg = format!("--input-ipc-server={}", MPV_SOCKET);
    StdCommand::new(&mpv)
        .arg("--idle")
        .arg("--keep-open=yes")
        .arg(&socket_arg)
        .spawn()
        .map_err(|e| format!("Failed to start mpv: {}", e))?;
    for _ in 0..100 {
        if UnixStream::connect(MPV_SOCKET).is_ok() { return Ok(()); }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    Err("mpv failed to start. Socket not created.".into())
}

#[tauri::command]
fn mpv_loadfile(url: String) -> Result<(), String> {
    let json = serde_json::json!({"command": ["loadfile", url]}).to_string();
    mpv_send(&json)
}

#[tauri::command]
fn mpv_set_property(name: String, value: String) -> Result<(), String> {
    let json = serde_json::json!({"command": ["set_property", name, value]}).to_string();
    mpv_send(&json)
}

#[tauri::command]
fn mpv_get_property(name: String) -> Result<String, String> {
    let json = serde_json::json!({"command": ["get_property", name]}).to_string();
    mpv_send_and_read(&json)
}

#[tauri::command]
fn mpv_stop() -> Result<(), String> {
    let _ = mpv_send(r#"{"command":["quit"]}"#);
    std::thread::sleep(std::time::Duration::from_millis(200));
    let _ = std::fs::remove_file(MPV_SOCKET);
    Ok(())
} 
fn sv(s: impl Into<String>) -> serde_json::Value {
    serde_json::Value::String(s.into())
}

// ===================== Dropbox API types =====================

#[derive(Debug, Deserialize)]
struct DropboxApiFile {
    pub name: String,
    pub path_lower: String,
    #[serde(rename = ".tag")]
    pub tag: String,
    pub size: Option<u64>,
    pub server_modified: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DropboxFile {
    pub name: String,
    pub path_lower: String,
    pub tag: String,
    pub size: Option<u64>,
    pub server_modified: Option<String>,
}

impl From<DropboxApiFile> for DropboxFile {
    fn from(f: DropboxApiFile) -> Self {
        Self { name: f.name, path_lower: f.path_lower, tag: f.tag, size: f.size, server_modified: f.server_modified }
    }
}

#[derive(Debug, Deserialize)]
struct DropboxApiListResult { entries: Vec<DropboxApiFile>, cursor: Option<String>, has_more: bool }
impl From<DropboxApiListResult> for DropboxListResult {
    fn from(r: DropboxApiListResult) -> Self { Self { entries: r.entries.into_iter().map(Into::into).collect(), cursor: r.cursor, has_more: r.has_more } }
}

#[derive(Debug, Serialize)]
pub struct DropboxListResult { pub entries: Vec<DropboxFile>, pub cursor: Option<String>, pub has_more: bool }

#[derive(Debug, Serialize, Deserialize)]
pub struct TemporaryLinkResult { pub link: String }

// ===================== OAuth types =====================

#[derive(Debug, Serialize, Deserialize)]
struct OAuthTokenResponse { access_token: String, refresh_token: Option<String>, expires_in: Option<u64>, #[serde(rename = "token_type")] _token_type: String, #[serde(rename = "uid")] _uid: Option<String>, #[serde(rename = "account_id")] _account_id: Option<String> }

const OAUTH_PORT: u16 = 4989;
const REDIRECT_URI: &str = "http://127.0.0.1:4989/callback";
const TOKEN_FILE: &str = "excubia_tokens.json";

fn get_token_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    let mut path = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    std::fs::create_dir_all(&path).ok();
    path.push(TOKEN_FILE); path
}

fn load_stored_token(app: &tauri::AppHandle) -> Option<String> {
    let path = get_token_path(app);
    let data = std::fs::read_to_string(path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&data).ok()?;
    let saved_at = parsed["saved_at"].as_u64().unwrap_or(0);
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
    if now > saved_at + 7 * 24 * 60 * 60 { return None; }
    if let Some(refresh_token) = parsed["refresh_token"].as_str() {
        let client = reqwest::blocking::Client::new();
        let params = [("grant_type", "refresh_token"), ("refresh_token", refresh_token), ("client_id", DROPBOX_APP_KEY)];
        if let Ok(resp) = client.post("https://api.dropboxapi.com/oauth2/token").form(&params).send() {
            if resp.status().is_success() {
                if let Ok(token_data) = resp.json::<serde_json::Value>() {
                    if let Some(new_access) = token_data["access_token"].as_str() {
                        save_tokens(app, new_access, Some(refresh_token));
                        return Some(new_access.to_string());
                    }
                }
            }
        }
        parsed["access_token"].as_str().map(String::from)
    } else { parsed["access_token"].as_str().map(String::from) }
}

fn save_tokens(app: &tauri::AppHandle, access: &str, refresh: Option<&str>) {
    let path = get_token_path(app);
    let mut map = serde_json::Map::new();
    map.insert("access_token".into(), serde_json::Value::String(access.into()));
    if let Some(r) = refresh { map.insert("refresh_token".into(), serde_json::Value::String(r.into())); }
    map.insert("saved_at".into(), serde_json::Value::Number(serde_json::Number::from(
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())));
    if let Ok(json) = serde_json::to_string(&map) { std::fs::write(path, json).ok(); }
}

// ===================== Tauri commands =====================

#[tauri::command]
async fn start_oauth(app: tauri::AppHandle) -> Result<String, String> {
    let app_key = DROPBOX_APP_KEY;
    if app_key.is_empty() { return Err("Dropbox App Key not configured".into()); }
    let code_verifier: String = rand::thread_rng().sample_iter(&rand::distributions::Alphanumeric).take(128).map(char::from).collect();
    let code_challenge = { let mut hasher = Sha256::new(); hasher.update(code_verifier.as_bytes()); URL_SAFE_NO_PAD.encode(hasher.finalize()) };
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let server = match tiny_http::Server::http(format!("127.0.0.1:{}", OAUTH_PORT)) { Ok(s) => s, Err(e) => { let _ = tx.send(Err(format!("Failed to start local server: {}", e))); return; } };
        if let Ok(mut request) = server.recv() {
            let url = request.url().to_string();
            let _ = request.respond(tiny_http::Response::from_string("<html><body><h2>Authenticated!</h2><p>You can close this window.</p></body></html>").with_status_code(200));
            let code = url::Url::parse(&format!("http://localhost{}", &url)).ok().and_then(|u| u.query_pairs().find(|(k, _)| k == "code").map(|(_, v)| v.to_string())).unwrap_or_default();
            if code.is_empty() { let _ = tx.send(Err("No authorization code received".into())); } else { let _ = tx.send(Ok(code)); }
        } else { let _ = tx.send(Err("Failed to receive OAuth callback".into())); }
    });
    let auth_url = format!("https://www.dropbox.com/oauth2/authorize?client_id={}&response_type=code&redirect_uri={}&token_access_type=offline&code_challenge_method=S256&code_challenge={}", app_key, REDIRECT_URI, code_challenge);
    let opened = StdCommand::new("open").arg(&auth_url).spawn().is_ok() || StdCommand::new("xdg-open").arg(&auth_url).spawn().is_ok();
    if !opened { return Err(format!("OPEN_BROWSER:{}", auth_url)); }
    let code: Result<String, String> = rx.recv().map_err(|_| "OAuth process interrupted".to_string())?;
    let code = code?;
    let client = reqwest::Client::new();
    let params = [("code", code.as_str()), ("grant_type", "authorization_code"), ("client_id", app_key), ("code_verifier", &code_verifier), ("redirect_uri", REDIRECT_URI)];
    let resp = client.post("https://api.dropboxapi.com/oauth2/token").form(&params).send().await.map_err(|e| format!("Token exchange failed: {}", e))?;
    if !resp.status().is_success() { let text = resp.text().await.unwrap_or_default(); return Err(format!("Token exchange error: {}", text)); }
    let token_data: OAuthTokenResponse = resp.json().await.map_err(|e| format!("Failed to parse token response: {}", e))?;
    save_tokens(&app, &token_data.access_token, token_data.refresh_token.as_deref());
    Ok(token_data.access_token)
}

#[tauri::command]
fn check_stored_token(app: tauri::AppHandle) -> Result<Option<String>, String> { Ok(load_stored_token(&app)) }

#[tauri::command]
fn clear_stored_token(app: tauri::AppHandle) -> Result<(), String> { let path = get_token_path(&app); std::fs::remove_file(path).ok(); Ok(()) }

#[tauri::command]
async fn dropbox_list_folder(access_token: String, path: String) -> Result<DropboxListResult, String> { dropbox::list_folder(&access_token, &path).await }
#[tauri::command]
async fn dropbox_get_temporary_link(access_token: String, path: String) -> Result<TemporaryLinkResult, String> { dropbox::get_temporary_link(&access_token, &path).await }
#[tauri::command]
async fn dropbox_search(access_token: String, query: String) -> Result<DropboxListResult, String> { dropbox::search(&access_token, &query).await }

// App key is read from the DROPBOX_APP_KEY environment variable at build time.
// Set it before building: export DROPBOX_APP_KEY=your_key_here
// Get one at https://www.dropbox.com/developers/apps
const DROPBOX_APP_KEY: &str = match option_env!("DROPBOX_APP_KEY") {
    Some(val) => val,
    None => "",
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            start_oauth, check_stored_token, clear_stored_token,
            dropbox_list_folder, dropbox_get_temporary_link, dropbox_search,
            start_mpv, mpv_loadfile, mpv_set_property, mpv_get_property, mpv_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
