use serde_json::Value;

const API_BASE: &str = "https://api.dropboxapi.com/2";

pub async fn list_folder(access_token: &str, path: &str) -> Result<super::DropboxListResult, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "path": if path.is_empty() { "" } else { path },
        "recursive": false,
        "include_media_info": false,
        "include_deleted": false,
        "include_has_explicit_shared_members": false,
    });

    let resp = client
        .post(format!("{}/files/list_folder", API_BASE))
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Dropbox API error: {}", text));
    }

    let result: super::DropboxApiListResult = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(result.into())
}

pub async fn get_temporary_link(
    access_token: &str,
    path: &str,
) -> Result<super::TemporaryLinkResult, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({ "path": path });

    let resp = client
        .post(format!("{}/files/get_temporary_link", API_BASE))
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Dropbox API error: {}", text));
    }

    let result: super::TemporaryLinkResult = resp
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(result)
}

pub async fn search(
    access_token: &str,
    query: &str,
) -> Result<super::DropboxListResult, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "query": query,
        "include_highlights": false,
    });

    let resp = client
        .post(format!("{}/files/search_v2", API_BASE))
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Dropbox API error: {}", text));
    }

    let val: Value = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
    let matches = val["matches"].as_array().cloned().unwrap_or_default();

    let entries: Vec<super::DropboxFile> = matches
        .iter()
        .filter_map(|m| {
            let meta = &m["metadata"];
            let tag = meta[".tag"].as_str()?;
            let name = meta["name"].as_str()?;
            Some(super::DropboxFile {
                name: name.to_string(),
                path_lower: meta["path_lower"].as_str().unwrap_or("").to_string(),
                tag: if tag == "folder" { "folder".to_string() } else { "file".to_string() },
                size: meta["size"].as_u64(),
                server_modified: meta["server_modified"].as_str().map(String::from),
            })
        })
        .collect();

    Ok(super::DropboxListResult {
        entries,
        cursor: None,
        has_more: false,
    })
}
