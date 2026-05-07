# Changelog

All notable changes to HomeArcade are documented here.

---

## [0.2.0] — 2026-05-07

### New systems
- **Game Boy** (gambatte core) — `.gb`
- **Game Boy Color** (gambatte core) — `.gbc`
- **Nintendo DS** (melonds core) — `.nds`
- **PSP** (ppsspp core) — `.iso`, `.cso`, `.pbp`
- **Dreamcast** (reicast core) — `.cdi`, `.gdi`, `.chd`

### Emulator features
- **Server-side save state backups** — each save slot gains ☁ Backup and ↺ Restore buttons; backups are stored in `/data/save-backups/` and survive browser clears and device switches
- **Gamepad tester** — "Test Pad" button opens a live visualisation of every connected controller with real-time axis and button readout
- **Named controller remap profiles** — remap layouts can be saved as named profiles per game and switched from a drop-down; profiles persist in `localStorage`
- **Netplay** — "Netplay" button opens a host/join room UI backed by EmulatorJS peer connections
- **RetroAchievements in-game integration** — credentials are injected into the emulator at launch so achievements unlock while you play

### Library & metadata
- **ROM MD5 hash** — every upload is hashed at ingest; hash is shown in the game detail dialog and stored in the database
- **EmulationStation XML import** — drop a `gamelist.xml` in Settings to bulk-import game metadata
- **LaunchBox XML import** — same flow with a LaunchBox platform XML export
- **Exact play-time tracking** — session duration is accumulated in the database and shown per game; replaces the old estimated figure
- **Recently Played shelf** — horizontal strip on system and collection pages showing the most recently launched ROMs in that context
- **Kiosk collection picker** — Settings lets you pin a specific collection for kiosk mode so only those games are visible

### RetroAchievements dashboard
- New `/achievements` page (trophy icon in sidebar) showing hardcore/softcore points, global rank, recently played games, and a list of recent unlocks
- RA credentials (username + API token) configured in Settings → RetroAchievements

### PWA
- Web app manifest and service worker bundled with the client
- Installable on Chrome/Edge desktop and iOS/Android via Add to Home Screen
- Offline support for cached assets

### Developer
- Vitest integration test suite (`npm test`) — 12 tests covering ROM list, collections CRUD, 404 handling, kiosk, settings, ES/LB importers, system images, and upload limits
- `vitest.config.ts` added; `test` and `test:watch` scripts in `package.json`

### Fixes
- Dockerfile: replaced `npm ci --include=dev` (invalid flag) with `npm install`; moved `NODE_ENV=production` to after the build so dev dependencies are not skipped during install

---

## [0.1.9] — 2026-05

### Emulator features
- **Save state thumbnails** — each slot captures a screenshot at save time
- **Rewind** — hold the rewind button to step backwards through gameplay
- **Fast-forward / turbo** — hold to run the emulator at increased speed
- **Cheat menu** — exposed the EmulatorJS built-in cheat code interface
- **In-game screenshot capture** — save a PNG of the current frame to your device
- **Shader / filter and aspect ratio controls** — choose CRT, scanline, or pixel-perfect filters and switch between 4:3, 16:9, and original aspect ratios
- **Per-game key remapping** — reassign any emulator button to a physical key or gamepad button; remaps persist per game

### Library & metadata
- **ScreenScraper metadata scraping** — fetch box art, screenshots, descriptions, genre, developer, publisher, and release date from ScreenScraper.fr
- **Genre / tag filtering** — filter any view by genre
- **Sort options** — sort by title, play count, recently played, or upload date
- **ZIP ROM support** — `.zip` and `.7z` archives accepted for all systems; first ROM inside is extracted at launch

### Integration
- **HA play session event logging** — game launch and end events are fired as Home Assistant webhook events, including duration
- **Kiosk / kid mode** — hide settings and management pages; optionally require a PIN to exit

### Fixes
- Build error: moved `extractFirstRomFromZip` to top-level scope so it is available to all route handlers

---

## [0.1.8] — 2026-05

### Emulator features
- **Multi-disc PS1 support** — `.cue`/`.bin` sets with matching filenames are grouped automatically; EmulatorJS disc-swap menu appears during play
- Save state paths corrected for EmulatorJS IDBFS layout

### Collections
- Collections page and API verified; empty-state handling improved

---

## [0.1.5] — 2026-05

### Emulator features
- **PS1 and PS2 controller layout** — L2, R2, L3, R3 buttons mapped; DualShock shoulder layout applied to PSX/PCSX2 cores
- **Save slots** — 4 save state slots with load/save controls in the emulator overlay
- **Memory card support** — PS1/PS2 memory card persistence wired through EmulatorJS

### Systems
- **PlayStation 2** added (pcsx2 core) — `.iso`, `.bin`

---

## [0.1.4] — 2026-05

### Upload
- ROM upload moved onto each system page — the active console is pre-selected so uploads are filed correctly without choosing a system manually
- Upload size cap raised past the Home Assistant ingress default of 16 MB; `ingress_stream: true` set in `config.yaml`; configurable via `max_upload_mb` option (default 2048 MB)
- Mobile upload picker fixed for Android/iOS

### Navigation
- Sidebar system links now drive the library filter via the URL, so the active system is preserved on page reload and is bookmarkable

### Integration
- Integration settings (HA base URL, token, endpoint overrides) persisted server-side in SQLite instead of only in browser `localStorage`

---

## [0.1.3] — 2026-05

### Add-on
- HomeArcade packaged as a Home Assistant add-on (Dockerfile, `config.yaml`, `run.sh`, `repository.yaml`)
- API calls corrected for the `/api/hassio_ingress/<token>/` prefix that HA Ingress prepends
- Add-on build fixed by colocating source with the Dockerfile context

### UI
- Console artwork added to Browse Systems tiles (sourced from Wikimedia Commons)
- Mobile virtual gamepad redesigned — d-pad and face buttons in separate zones to prevent simultaneous-press collisions
- Uploaded ROM management page (delete, view metadata)

---

## [0.1.0] — 2026-05

Initial release.

- React + Vite SPA with Express backend
- Browse Systems page with NES, SNES, N64, GBA, Genesis, PS1, Arcade tiles
- ROM upload with per-system file extension validation
- EmulatorJS in-browser emulation with virtual on-screen gamepad
- SQLite database via Drizzle ORM for ROM metadata and settings
- Game Collections (create, rename, delete; add games from detail dialog)
- All Games view with search
