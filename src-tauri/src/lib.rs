use serde::{Deserialize, Serialize};
use std::process::Command as StdCommand;
use tauri::Manager;

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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let _window = app.get_webview_window("main").unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            dropbox_list_folder,
            dropbox_get_temporary_link,
            dropbox_search,
            launch_mpv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
