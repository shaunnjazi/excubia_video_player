import { invoke } from '@tauri-apps/api/core'

declare global {
  interface Window {
    __TAURI_INTERNALS__?: Record<string, unknown>
  }
}

const API_BASE = 'https://api.dropboxapi.com/2'

function isTauri(): boolean {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
}

export interface DropboxEntry {
  name: string
  path_lower: string
  tag: 'file' | 'folder'
  size?: number
}

export interface ListResult {
  entries: DropboxEntry[]
  cursor?: string
  has_more: boolean
}

export async function listFolder(accessToken: string, path: string): Promise<ListResult> {
  if (isTauri()) {
    return invoke('dropbox_list_folder', { accessToken, path })
  }
  const resp = await fetch(`${API_BASE}/files/list_folder`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: path || '', recursive: false }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Dropbox API error (${resp.status}): ${text}`)
  }
  return resp.json()
}

export async function getTemporaryLink(accessToken: string, path: string): Promise<string> {
  if (isTauri()) {
    const result = await invoke<{ link: string }>('dropbox_get_temporary_link', { accessToken, path })
    return result.link
  }
  const resp = await fetch(`${API_BASE}/files/get_temporary_link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Dropbox API error (${resp.status}): ${text}`)
  }
  const data = await resp.json()
  return data.link
}

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.mpg', '.mpeg', '.wmv', '.flv', '.ts']
const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass', '.ssa', '.sub', '.idx']

export function isVideoFile(name: string): boolean {
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase()
  return VIDEO_EXTENSIONS.includes(ext)
}

export function isSubtitleFile(name: string): boolean {
  const ext = name.substring(name.lastIndexOf('.')).toLowerCase()
  return SUBTITLE_EXTENSIONS.includes(ext)
}
