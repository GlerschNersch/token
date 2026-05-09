# Changelog

## 0.6.0

- Feature: **TheGamesDB scraper** — new primary metadata source for box art, descriptions, genre, developer, and publisher; add your free API key in Settings → Services; cascades to ScreenScraper then Libretro thumbnails
- Feature: **Play History page** — dedicated history view showing sessions grouped by day, per-game playtime bar chart, total playtime stats, and most-played summary; accessible from sidebar and mobile nav
- Feature: **Per-profile favorites, ratings, and play status** — each named profile maintains its own favorites, star ratings, and backlog/playing/completed status independently of the global library
- Feature: **Per-profile key bindings** — Settings → Controls now has a profile selector; each profile stores keyboard overrides loaded at game launch
- Feature: **Mobile landscape mode** — on-screen pad resizes correctly in landscape orientation with button press animation on touch devices
- Fix: Map iteration in netplay.ts uses Array.from() for ES2015 compatibility

## 0.5.3

- Feature: ROM upload progress bar with per-file and overall percentage

## 0.5.2

- Fix: critical SyntaxError in bootstrap.js caused by regex backslash consumption inside TypeScript template literals; replaced with indexOf/slice URL derivation

## 0.5.1

- Fix: netplay relay URL derivation behind HA Ingress prefix

## 0.5.0

- Feature: **Named player profiles** — create profiles in Settings; switch from the library header; save states, cheats, and key remaps isolated per profile
- Feature: **Cheat codes panel** — add, toggle, and delete cheat codes per game per profile from the in-game panel
- Feature: **Shader presets** — Scanlines, LCD (pixel-perfect), Phosphor (green glow)
- Feature: **Netplay** — WebSocket relay server; create or join a room code to play with a friend

## 0.3.15

- Feature: Settings page now uses tabs (General, Library, Services, Controls, Kiosk, HA Setup)
- Feature: Controls tab — per-console keyboard binding editor; click any button to remap, saves globally, applied on next game launch
- Schema: added controlDefaults to integration settings; server reads saved bindings and injects into EJS_defaultControls at launch time

## 0.3.14

- Polish: Settings page cleaned up — removed duplicate RetroAchievements and EmulationStation sections, removed stale prototype language, regrouped service credentials together, cleaner section order

## 0.3.13

- Fix: fast-forward button now calls Module.setFastForward() with fallback chain for different EmulatorJS builds
- Fix: rewind changed from broken toggle to hold-to-rewind (mousedown/touchstart starts rewind, mouseup/touchend stops) — matches how RetroArch rewind actually works

## 0.3.12

- Fix: ReferenceError in bootstrap.js diagnostic — `core` used as JS runtime variable instead of TS template interpolation; changed to `${core}` so it resolves server-side

## 0.3.11

- Fix: critical SyntaxError in bootstrap.js line 877 — `rows.join("\n")` inside a TypeScript template literal produced a literal newline character in generated JS, breaking game loading; changed to `rows.join("")`

## 0.3.10

- Fix: critical SyntaxError in bootstrap.js (introduced by v0.3.9 diagnostic) — JSON.stringify inside a string literal broke game loading entirely
- The diagnostic console.log now uses string concatenation instead of JSON.stringify

## 0.3.9

- Fix: system logo `<img>` src now routed through `apiUrl()` — fixes 404s hitting HA's own API instead of the addon under Ingress
- Fix: system hardware image URLs now routed through `apiUrl()` for the same reason
- Fix: TypeScript error in Dashboard.tsx (`all` object typed as `Record<string,number>`; `uploadedRoms` prop removed from Sidebar call)
- Fix: `system?.monogram` → `system?.mono` in Home.tsx
- Debug: bootstrap.js now logs `[HomeArcade]` markers to browser console and shows `ERR` in the progress overlay if it fails to load — helps diagnose 0% game loading

## 0.3.8

- Fix: service worker now uses a versioned cache name (`home-arcade-v0.3.8`) so stale JS is cleared on every addon update
- Fix: shell HTML is now fetched network-first so the app always boots with the latest code

## 0.3.7

- Removed Quick action endpoints section from Settings
- Removed Wiring guide section from Settings
- Removed PC Status panel section from Settings

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
