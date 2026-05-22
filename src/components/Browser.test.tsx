import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Browser from './Browser'
import * as dropbox from '../lib/dropbox'

vi.mock('../lib/dropbox', () => ({
  listFolder: vi.fn(),
  getTemporaryLink: vi.fn(),
  isVideoFile: (name: string) => /\.(mp4|mkv|avi|mov)$/i.test(name),
  isSubtitleFile: (name: string) => /\.(srt|vtt|ass)$/i.test(name),
  sortEntries: (entries: any[]) => entries,
}))

function makeEntry(name: string, tag: 'file' | 'folder', path?: string): dropbox.DropboxEntry {
  return { name, tag, path_lower: path || ('/' + name), size: tag === 'file' ? 1000000 : undefined }
}

const defaultProps = {
  accessToken: 'test',
  onPlayVideo: vi.fn(),
  onNavigate: vi.fn(),
  currentPath: '',
  view: 'browse' as const,
}

describe('Browser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state on mount', () => {
    vi.mocked(dropbox.listFolder).mockReturnValue(new Promise(() => {}))
    render(<Browser {...defaultProps} />)
    expect(screen.getByText('Loading...')).toBeTruthy()
  })

  it('shows error state when listFolder fails', async () => {
    vi.mocked(dropbox.listFolder).mockRejectedValue(new Error('Network error'))
    render(<Browser {...defaultProps} />)
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
    render(<Browser {...defaultProps} />)
    expect(await screen.findByText('folder1')).toBeTruthy()
    expect(await screen.findByText('video.mp4')).toBeTruthy()
  })

  it('shows empty message when no files', async () => {
    vi.mocked(dropbox.listFolder).mockResolvedValue({
      entries: [], cursor: undefined, has_more: false,
    })
    render(<Browser {...defaultProps} />)
    expect(await screen.findByText('No files found')).toBeTruthy()
  })
})
