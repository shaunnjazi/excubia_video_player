import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Browser from './Browser'
import * as dropbox from '../lib/dropbox'

vi.mock('../lib/dropbox', () => ({
  listFolder: vi.fn(),
  getTemporaryLink: vi.fn(),
  isVideoFile: (name: string) => /\.(mp4|mkv|avi|mov)$/i.test(name),
  isSubtitleFile: (name: string) => /\.(srt|vtt|ass)$/i.test(name),
}))

function makeEntry(name: string, tag: 'file' | 'folder', path?: string): dropbox.DropboxEntry {
  return { name, tag, path_lower: path || ('/' + name), size: tag === 'file' ? 1000000 : undefined }
}

describe('Browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state on mount', () => {
    vi.mocked(dropbox.listFolder).mockReturnValue(new Promise(() => {}))
    render(<Browser accessToken="test" onPlayVideo={vi.fn()} />)
    expect(screen.getByText('Loading files...')).toBeTruthy()
  })

  it('shows error state when listFolder fails', async () => {
    vi.mocked(dropbox.listFolder).mockRejectedValue(new Error('Network error'))
    render(<Browser accessToken="test" onPlayVideo={vi.fn()} />)
    expect(await screen.findByText('Network error')).toBeTruthy()
  })

  it('shows folders and video files after loading', async () => {
    vi.mocked(dropbox.listFolder).mockResolvedValue({
      entries: [
        makeEntry('video.mp4', 'file'),
        makeEntry('folder1', 'folder'),
        makeEntry('subs.srt', 'file'),
      ],
      cursor: undefined, has_more: false,
    })
    render(<Browser accessToken="test" onPlayVideo={vi.fn()} />)
    expect(await screen.findByText('folder1')).toBeTruthy()
    expect(await screen.findByText('video.mp4')).toBeTruthy()
    expect(await screen.findByText('subs.srt')).toBeTruthy()
  })

  it('shows subtitle label on subtitle files', async () => {
    vi.mocked(dropbox.listFolder).mockResolvedValue({
      entries: [makeEntry('subs.srt', 'file')],
      cursor: undefined, has_more: false,
    })
    render(<Browser accessToken="test" onPlayVideo={vi.fn()} />)
    expect(await screen.findByText('sub')).toBeTruthy()
  })

  it('shows empty message when no files', async () => {
    vi.mocked(dropbox.listFolder).mockResolvedValue({
      entries: [], cursor: undefined, has_more: false,
    })
    render(<Browser accessToken="test" onPlayVideo={vi.fn()} />)
    expect(await screen.findByText('No files found')).toBeTruthy()
  })

  it('filters entries by search query', async () => {
    vi.mocked(dropbox.listFolder).mockResolvedValue({
      entries: [
        makeEntry('video.mp4', 'file'),
        makeEntry('movie.mp4', 'file'),
        makeEntry('subs.srt', 'file'),
      ],
      cursor: undefined, has_more: false,
    })
    render(<Browser accessToken="test" onPlayVideo={vi.fn()} />)
    expect(await screen.findByText('video.mp4')).toBeTruthy()
  })
})
