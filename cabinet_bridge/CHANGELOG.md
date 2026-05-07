# Changelog

## 0.3.6

- System logos now served through `/api/system-logos/:id` proxy — fixes CORS blocks under HA Ingress
- System hardware images return a dark SVG placeholder instead of a 404 when Wikimedia is unreachable
- Removed `crossOrigin` attribute from logo img tags (no longer needed with same-origin proxy)

## 0.3.5

- Controls button now opens a proper panel with the full keyboard layout for the active system (PS1/PS2, GBA, GB/GBC, N64, NDS, PSP, and generic)
- Panel dynamically adapts to the loaded core — shows the right buttons for each console
- Closes on backdrop click, Escape, or ×

## 0.3.4

- **Home Dashboard** — new default landing page with Continue Playing hero, stat cards (total hours, completed, in progress, backlog), system play-time bars, status donut chart, week-over-week activity, game highlights, and In Progress / Recently Played / New This Week shelves
- Sidebar gains a Dashboard nav link
- Library view moved to `/library`

## 0.3.3

- Removed the ARCADE-PC / Offline status pill from the sidebar footer

## 0.3.2

- Removed the Emulator PC right-panel widget (was showing mock offline data)

## 0.3.1

- Live PC status polling from Home Assistant entities (CPU %, RAM %, current app, online state)
- Settings: PC Status panel with fields for entity IDs (Online, CPU %, RAM %, Current App)

## 0.3.0

- **Community score** — scraped from ScreenScraper (`jeu.note`, /20 scale displayed as /10) and shown in game detail dialog
- **Wheel art** — logo overlay fetched from ScreenScraper wheel-hd/wheel/wheel-carbon media; shown in game detail header
- Game detail dialog polish: genre pills, wheel art logo, community score stat, graceful art fallback

## 0.2.0

- Game Boy, Game Boy Color, Nintendo DS, PSP, and Dreamcast system support
- Server-side save state backups (survive browser clears)
- Gamepad tester with live axis/button readout
- Named controller remap profiles
- Netplay host/join room UI
- RetroAchievements in-game integration and dashboard page
- ROM MD5 hash verification
- EmulationStation and LaunchBox XML import
- Exact play-time tracking
- Recently Played shelf
- Kiosk collection picker
- PWA manifest — installable on desktop and mobile
- Vitest integration test suite

## 0.1.9

- Save state thumbnails
- Rewind and fast-forward/turbo
- Cheat menu
- In-game screenshot capture
- Shader/filter and aspect ratio controls
- Per-game key remapping
- ScreenScraper metadata scraping (box art, screenshots, description, genre, developer, release date)
- Genre/tag filtering and sort options
- ZIP and 7z ROM support
- HA play session event logging
- Kiosk / kid mode with optional PIN

## 0.1.8

- Multi-disc PS1 support — `.cue`/`.bin` sets auto-grouped; EmulatorJS disc-swap menu
- Save state path fixes

## 0.1.5

- PlayStation 2 (pcsx2 core)
- DualShock L2/R2/L3/R3 mapping for PS1 and PS2
- 4-slot save states with load/save controls
- PS1/PS2 memory card persistence

## 0.1.4

- ROM upload moved to system pages; upload size cap raised (default 2 GB)
- Sidebar system links are URL-driven and bookmarkable
- Integration settings persisted server-side in SQLite

## 0.1.3

- Home Assistant add-on packaging (Dockerfile, config.yaml, run.sh, repository.yaml)
- Ingress path prefix fix
- Console artwork on Browse Systems tiles
- Mobile virtual gamepad redesign

## 0.1.0

Initial release — React + Vite SPA, Express backend, EmulatorJS, SQLite via Drizzle ORM, ROM upload, game collections.
