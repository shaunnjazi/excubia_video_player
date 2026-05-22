# Excubia Player — Architecture

## The Problem

The web app needed ffmpeg on a Vercel server to remux MKV → MP4 because browsers can't handle MKV, HEVC, or multiple audio tracks natively. Every action (play, seek, switch audio, load subtitles) required a server round-trip.

## The Solution

A native desktop app that streams **directly** from Dropbox's CDN.

```
User clicks video → Get Dropbox temporary link → Pass URL to mpv → mpv renders natively
```

No server. No remuxing. No delays.

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | **Tauri v2** (Rust) |
| Frontend | React 18 + TypeScript + Vite |
| Video engine | **mpv** (via `tauri-plugin-mpv` JSON IPC) |
| Streaming | Direct from Dropbox CDN |
| Auth | Dropbox OAuth v2 |

## Data Flow

```
┌──────────────┐         ┌──────────────────┐         ┌────────────────┐
│  React UI    │ ◄──IPC──►  Tauri/Rust      │ ◄──HTTP──►  Dropbox API   │
│  (controls,  │         │  (auth, browser, │         │  (file listing, │
│   overlays)  │         │   mpv control)   │         │   temp links)   │
└──────┬───────┘         └────────┬─────────┘         └────────────────┘
       │                          │
       │ send mpv commands        │ get temp link
       ▼                          ▼
┌─────────────────────────────────────────────┐
│  mpv (native process, embedded in window)   │
│  ─ streams directly from Dropbox CDN URL    │
│  ─ native MKV/HEVC/ASS support              │
│  ─ instant audio/subtitle switching         │
└─────────────────────────────────────────────┘
```

## Key Differences from Web App

| Capability | Web App | Native App |
|---|---|---|
| MKV playback | ffmpeg remux required | Native mpv support |
| Audio switching | Server round-trip (~30s) | Client-side mpv command (~10ms) |
| Subtitle rendering | Server extraction | Native mpv (ASS/PGS/SRT) |
| Seeking | Server-side ffmpeg | Native mpv (instant) |
| Codec support | Browser-dependent | Anything ffmpeg supports |
| Server needed | Vercel + ffmpeg | None (just Dropbox API) |

## File Structure

```
excubia_player/
├── src/                          # React frontend
│   ├── main.tsx                  # React entry
│   ├── App.tsx                   # Root component (auth → browser → player)
│   ├── App.css                   # Global styles (transparent bg for mpv)
│   ├── components/
│   │   ├── Player.tsx            # Mpv controls overlay (play/pause/seek/volume)
│   │   ├── Browser.tsx           # Dropbox file tree browser
│   │   ├── Sidebar.tsx           # Navigation (Browse / Recent / Settings)
│   │   ├── AuthGate.tsx          # Dropbox OAuth login screen
│   │   └── TrackSelector.tsx     # Audio & subtitle track lists
│   ├── hooks/
│   │   └── useMpv.ts            # React hook wrapping mpv IPC
│   └── lib/
│       └── dropbox.ts            # Dropbox API client (list, search, get links)
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json           # Window config + plugins
│   ├── capabilities/default.json # Tauri permissions
│   └── src/
│       ├── main.rs               # Entry point
│       ├── lib.rs                # Tauri commands (mpv control, Dropbox proxy)
│       └── dropbox.rs            # Dropbox API calls
├── package.json                  # npm deps (React, Tauri CLI)
├── vite.config.ts
├── tsconfig.json
└── index.html
```

## Setup Steps (macOS)

1. `brew install mpv` — mpv must be installed system-wide
2. `export DROPBOX_APP_KEY=your_key` — set your Dropbox App Key (get from Developer Console)
3. `npm install` — install React + Tauri deps
4. `npm run tauri dev` — launch in dev mode
5. Click "Login with Dropbox" in the app

## Future Enhancements

- Full Dropbox OAuth flow (system browser → callback server)
- Bundled libmpv (no Homebrew dependency)
- Hardware-accelerated rendering (NSOpenGLView on macOS)
- Picture-in-Picture, subtitle offset, playlist management
