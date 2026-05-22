export interface PlaylistItem {
  path: string
  name: string
  size?: number
  added: number
}

const PLAYLIST_KEY = 'excubia_playlist'
const SHUFFLE_KEY = 'excubia_playlist_shuffle'
const REPEAT_KEY = 'excubia_playlist_repeat'

export function getPlaylist(): PlaylistItem[] {
  try { return JSON.parse(localStorage.getItem(PLAYLIST_KEY) || '[]') } catch { return [] }
}

export function savePlaylist(items: PlaylistItem[]) {
  localStorage.setItem(PLAYLIST_KEY, JSON.stringify(items))
}

export function addToPlaylist(item: PlaylistItem) {
  const list = getPlaylist().filter(p => p.path !== item.path)
  list.push(item)
  savePlaylist(list)
}

export function addMultipleToPlaylist(items: PlaylistItem[]) {
  const existing = getPlaylist()
  const existingPaths = new Set(existing.map(p => p.path))
  for (const item of items) {
    if (!existingPaths.has(item.path)) {
      existing.push(item)
      existingPaths.add(item.path)
    }
  }
  savePlaylist(existing)
}

export function removeFromPlaylist(path: string) {
  savePlaylist(getPlaylist().filter(p => p.path !== path))
}

export function clearPlaylist() {
  localStorage.removeItem(PLAYLIST_KEY)
}

export function reorderPlaylist(from: number, to: number) {
  const list = getPlaylist()
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  savePlaylist(list)
}

export function getShuffle(): boolean {
  return localStorage.getItem(SHUFFLE_KEY) === 'true'
}

export function setShuffle(on: boolean) {
  localStorage.setItem(SHUFFLE_KEY, on ? 'true' : 'false')
}

export type RepeatMode = 'off' | 'all' | 'one'

export function getRepeat(): RepeatMode {
  const v = localStorage.getItem(REPEAT_KEY) as RepeatMode | null
  return v || 'off'
}

export function setRepeat(mode: RepeatMode) {
  localStorage.setItem(REPEAT_KEY, mode)
}

export function nextVideo(currentPath: string): PlaylistItem | null {
  const list = getPlaylist()
  if (list.length === 0) return null
  const mode = getRepeat()
  if (mode === 'one') return list.find(p => p.path === currentPath) || list[0]
  const idx = list.findIndex(p => p.path === currentPath)
  if (getShuffle()) {
    const others = list.filter((_, i) => i !== idx)
    if (others.length === 0) return list[0]
    return others[Math.floor(Math.random() * others.length)]
  }
  if (idx < list.length - 1) return list[idx + 1]
  if (mode === 'all' && list.length > 0) return list[0]
  return null
}
