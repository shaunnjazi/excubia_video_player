# Excubia Player

A native macOS desktop video player for **Dropbox**. Stream your video files directly from Dropbox without downloading them. Built with [Tauri v2](https://v2.tauri.app/), [React](https://react.dev/), and [mpv](https://mpv.io/).

## Features

- **Dropbox streaming** — Browse your Dropbox files and play videos directly, no downloading needed
- **Native playback** — Powered by mpv, supporting MKV, HEVC, AV1, ASS subtitles, and every format ffmpeg supports
- **Multiple audio tracks** — Switch between languages/commentary tracks instantly via mpv
- **Subtitles** — Embedded and external subtitle support (SRT, VTT, ASS, SSA)
- **Playlist** — Queue videos with shuffle, repeat, and drag-and-drop reorder
- **Hardware acceleration** — GPU decoding via mpv's `hwdec=auto-safe`
- **File browser** — Browse your Dropbox folder tree with sorting by name/size/date
- **Recent videos** — Quickly resume recently watched files
- **Keyboard shortcuts** — Space (play/pause), arrows (seek/volume), F (fullscreen)
- **Dark theme** — GitHub Dark-inspired UI throughout

## Requirements

- **macOS** 10.15+ (Apple Silicon or Intel)
- **mpv** — Install via Homebrew: `brew install mpv`
- **Dropbox account** — Free tier works

## Quick Start

### 1. Install mpv

```bash
brew install mpv
```

### 2. Download the app

Grab the latest `.dmg` from the [Releases page](https://github.com/shaunnjazi/excubia_video_player/releases), or build from source:

```bash
git clone https://github.com/shaunnjazi/excubia_video_player.git
cd excubia_video_player
```

### 3. Set up your Dropbox App Key

You need a Dropbox API key to use this app. It's free and takes 2 minutes:

1. Go to the [Dropbox Developer Console](https://www.dropbox.com/developers/apps)
2. Click **Create app**
3. Choose **Scoped access** → **Full Dropbox** → name it (e.g. "Excubia Player")
4. Under **OAuth 2**, click **Add redirect URI** and enter: `http://127.0.0.1:4989/callback`
5. Click **Permissions** and check: `files.metadata.read`, `files.content.read`
6. Copy the **App Key** (not the secret)

### 4. Build and run

```bash
# Set your app key as an environment variable
export DROPBOX_APP_KEY=your_app_key_here

# Install dependencies and run
npm install
npm run tauri dev
```

The app will open. Click **Login with Dropbox**, authenticate in your browser, and you're in.

### Building a distributable .dmg

```bash
export DROPBOX_APP_KEY=your_app_key_here
npm run tauri build
```

The `.dmg` will be at `src-tauri/target/release/bundle/dmg/`.

### Running without installation

After building, you can run the `.app` directly without installing the DMG:

```bash
open src-tauri/target/release/bundle/macos/Excubia\ Player.app
```

Or run the binary directly:

```bash
src-tauri/target/release/excubia-player
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Excubia Player                     │
├───────────────┬─────────────────────────────────────┤
│   Sidebar     │         Browser / Player             │
│  ┌─────────┐  │  ┌────────────────────────────────┐ │
│  │ Browse  │  │  │  Dropbox File Browser           │ │
│  │ Recent  │  │  │  - Folder tree (lazy loaded)    │ │
│  ├─────────┤  │  │  - Sort by name/size/date      │ │
│  │ Folder  │  │  │  - Search/filter               │ │
│  │ Tree    │  │  └────────────────────────────────┘ │
│  │ (lazy)  │  │                                     │
│  └─────────┘  │  ┌────────────────────────────────┐ │
│               │  │  Now Playing Bar               │ │
│  Disconnect   │  │  - Play/Pause/Next/Prev        │ │
└───────────────┘  │  - Volume, progress, time       │ │
                   │  - Playlist integration         │ │
                   └────────────────────────────────┘ │
                   ┌────────────────────────────────┐ │
                   │    mpv (separate process)       │ │
                   │  - IPC via Unix socket          │ │
                   │  - Hardware decoding            │ │
                   │  - All formats/codecs           │ │
                   └────────────────────────────────┘ │
                   ┌────────────────────────────────┐ │
                   │    Rust Backend (Tauri)         │ │
                   │  - OAuth PKCE flow              │ │
                   │  - Dropbox API proxy            │ │
                   │  - mpv IPC control              │ │
                   │  - Local HTTP server (auth)     │ │
                   └────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Key components

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop shell | Tauri v2 | Native window, menus, keyboard shortcuts |
| Frontend | React 18 + TypeScript | File browser, playlist, controls UI |
| Video engine | mpv (via Unix socket IPC) | Playback, audio/subtitle switching |
| Dropbox API | reqwest (Rust) | File listing, temporary streaming links |
| Auth | OAuth 2.0 PKCE | Secure login without client secret |
| State | localStorage | Playlist, recent files, volume preferences |

## How It Works

### Streaming
Files stream directly from Dropbox's CDN — no intermediate server required. When you click a video:

1. App requests a temporary direct link from Dropbox API (valid 4 hours)
2. Link is passed to mpv via `--input-ipc-server` Unix socket
3. mpv streams directly from Dropbox with hardware-accelerated decoding
4. Playback controls are sent as JSON commands over the socket

### Audio/Subtitle Switching
Since mpv handles all media natively, switching audio tracks or subtitles is instant — just a `set_property` IPC command. No remuxing, no server round-trip, no delays.

### Authentication
The app uses OAuth 2.0 with PKCE (Proof Key for Code Exchange) — a cryptographic handshake that eliminates the need for a client secret. A local HTTP server on port 4989 catches the OAuth redirect and exchanges the code for tokens. Tokens are stored in the app's data directory and auto-refreshed.

## Security

- **Your app key** is set via the `DROPBOX_APP_KEY` environment variable at build time — never hardcoded in the repo
- **OAuth tokens** are stored in `~/Library/Application Support/com.excubia.player/excubia_tokens.json`
- **Refresh tokens** are automatically rotated — no re-login needed unless inactive for 7 days
- **No server** — the app communicates directly with Dropbox's API. No third-party servers see your files
- **PKCE flow** — no client secret needed, preventing secret leakage

## Development

### Prerequisites

- Rust toolchain: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Node.js 18+: `brew install node`
- mpv: `brew install mpv`

### Commands

```bash
npm run tauri dev      # Development mode with hot reload
npm run tauri build    # Production build
npm test               # Run tests
npm run tauri icon     # Generate app icons
```

### Project structure

```
src/                    # React frontend
  components/
    AuthGate.tsx        # Dropbox login screen
    Browser.tsx         # File browser with sorting/search
    Sidebar.tsx         # Folder tree navigation
    NowPlaying.tsx      # Playback controls bar
    PlaylistSidebar.tsx # Playlist with shuffle/repeat
    ToastContainer.tsx  # Toast notification system
    TrackSelector.tsx   # Audio/subtitle track dropdown
    Skeleton.tsx        # Loading placeholder
  contexts/
    ToastContext.tsx    # Toast state management
  services/
    playlist.service.ts # Playlist persistence
  lib/
    dropbox.ts          # Dropbox API client

src-tauri/              # Rust backend
  src/
    lib.rs              # Tauri commands, OAuth, mpv IPC
    dropbox.rs          # Dropbox API calls
  Cargo.toml            # Rust dependencies
  tauri.conf.json       # Tauri configuration
```

## Comparison: Web App vs Native

| Feature | Web App | Native App |
|---------|---------|------------|
| MKV playback | ffmpeg remux required (slow) | Native mpv (instant) |
| Audio switching | Server round-trip (~30s) | IPC command (~10ms) |
| Subtitle rendering | Server extraction needed | Native mpv ASS/PGS support |
| Seeking | Requires ffmpeg | Native mpv (instant) |
| Hardware decoding | Browser-limited | GPU via mpv |
| Server needed | Vercel + ffmpeg | None (just Dropbox API) |
| Authentication | OAuth in browser | OAuth in-app |

## License

MIT
