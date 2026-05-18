## 2.24.25 – 2026-05-18

- **Feature**: **Art Coverage Test Suite** — Added `e2e/art-coverage.spec.ts` to diagnose missing game cover thumbnails. Reports per-game and per-system art coverage, flags recently-played games missing art, and distinguishes real images vs. gradient fallbacks.

## 2.24.24 – 2026-05-18

- **Feature**: **Comprehensive Playwright UX Test Suite** — Added `e2e/ux.spec.ts` covering sidebar navigation, game library interactions, search/sort/filter, game detail dialogs, settings, keyboard navigation, mobile responsive, and edge cases.

- **Fix**: **Exit Game Button** — Fixed a bug where the "Exit Game" button in the emulator menu was non-functional. It now correctly returns you to the library.

## 2.24.9 – 2026-05-17

- **Fix**: **Warp Link Database Error** — Resolved the "no such column: rom_hash" error that prevented save-state syncing during Warp sessions.

## 2.24.8 – 2026-05-17

- **Feature**: **Warp to Mobile (Pre-launch)** — Added the ability to generate a Warp QR code directly from the game detail dialog and dashboard.
- **Feature**: **Automatic Save-State Warping** — Warp links now automatically include the latest save state if available, allowing for seamless session hand-offs.
- **Improved**: **Warp UI** — New instructions and visual feedback during Warp Link generation.

## 2.3.0 – 2026-05-16

- **Performance**: **EmulatorJS CDN disk cache** — EJS core assets (`.wasm`, `.js`, `.data`) are now cached to `data/ejs_cache/` on first load and served from local disk on all subsequent requests, eliminating repeated internet fetches for multi-MB cores.
- **Performance**: **ROM range streaming** — the `/api/roms/:id/file` endpoint now handles `Range:` requests, allowing the browser to stream only the bytes it needs rather than buffering the entire ROM before emulation starts.
- **Performance**: **`Accept-Ranges` + `immutable` cache on EJS assets** — browser skips conditional requests for cached core files entirely.
- **Performance**: **Bootstrap script caching** — `bootstrap.js` now carries a `private, max-age=300` header; identical ROM+profile combos are served from browser cache.
- **Performance**: **Player shell caching** — the emulator player HTML is now cached for 60 seconds to avoid re-serving the full shell on every visit.

## 1.1.14 – 2026-05-15

- **Major**: **Full Localization Support** — Replaced all hardcoded English strings with dynamic translation keys across the entire application.
- **Improved**: **Multi-language Synchronization** — All 7 supported languages (EN, ES, FR, DE, PT, JA, ZH) are now 100% synchronized and up-to-date.
- **Improved**: **Settings UI** — Every label and hint in the Settings page is now fully translatable.
- **Improved**: **Dashboard & Home** — Localized all stats, headers, and UI elements.

## 1.1.13 – 2026-05-15

- **Improved**: **Performance** — Applied priority rendering flags to game cards in the Dashboard shelves and Home page "Jump Back In" sections for faster above-the-fold loading.

## 1.1.12 – 2026-05-15

- **Improved**: **Performance** — Implemented Intersection Observer for library game cards to reduce memory/CPU load.
- **Improved**: **Load Speed** — Added fetch priority and eager loading for the first 10 items in any grid.
- **Improved**: **Polling** — Reduced frequency of background API calls when the app is idle or hidden.
- **Improved**: **Touch UX** — Disabled video previews on touch devices and added scroll restoration for smoother navigation.

## 1.1.11 – 2026-05-15

- **Feature**: **Theme Visual Polish** — Added unique aesthetics (Win95 bevels, Gameboy dot-matrix, Synthwave glows, Arcade scanlines) to specific themes.

## 1.1.10 – 2026-05-15

- **Fix**: **UI Themes** — Updated CSS selectors to `.dark[data-theme="..."]` to ensure they have higher specificity and correctly override default dark mode variables.
- **Improved**: **Theme Application** — Theme changes now apply instantly and reliably across the entire interface.

## 1.1.9 – 2026-05-15

- **Fix**: **Emulator Bootstrap** — Resolved "bootstrap.js blocked" error by correctly passing global display settings (aspect ratio, shader) to the emulator loader script.
- **Fix**: **Variable Scope** — Resolved a ReferenceError that prevented the dynamic generation of the emulator loading sequence.

## 1.1.8 – 2026-05-15

- **Feature**: **18 UI Themes** — Implemented full CSS definitions for 18 diverse aesthetics including Synthwave, Gameboy, OLED, Cyberpunk, and Win95.
- **Improved**: **Performance** — Removed unused adaptive background CSS to streamline the main stylesheet and improve rendering speed.

## 1.1.7 – 2026-05-15

- **Fix**: **Dashboard Crash** — Resolved a white screen crash caused by a missing `useIntegration` import in the Dashboard component.

## 1.1.6 – 2026-05-15

- **Fix**: **Logic Restoration** — Restored essential library management code in `Home.tsx` that was accidentally omitted during the display settings refactor.
- **Fix**: **Dependency Isolation** — Broke a circular dependency between Settings and App modules by moving theme definitions to `lib/themes.ts`.

## 1.1.5 – 2026-05-15

- **Feature**: **Per-System Overrides** — Users can now set custom Aspect Ratios, Shaders, and Integer Scaling for each gaming system individually.
- **Feature**: **Global Preferences** — Added global fallback settings for aspect ratio and shaders in Settings → Display.
- **Feature**: **System Labels Toggle** — Added an option to hide console names on game cards across the entire UI for a cleaner look.
- **Fix**: **Translation Sync** — Changing the language in Settings now immediately updates the UI without requiring a manual refresh.

## 1.1.4 – 2026-05-14

- **Feature**: **Official System Logos** — Replaced hardware photos with official branding logos on all system tiles for much clearer navigation. Logos are automatically fetched and cached from Libretro assets.
- **Improved**: **System Tiles** — Redesigned tiles to overlay branding logos on top of hardware photos (when available), creating a premium, high-contrast look.

## 1.1.3 – 2026-05-14

- **New**: **Bulk Scrape** — Added a "Scrape All" button in Settings → Services to refresh metadata and art for all unscraped or failed ROMs.
- **Fix**: **Settings UI Restored** — Fixed a regression where the Services and Kiosk tabs were missing from the Settings menu.
- **Fix**: **Build Stability** — Resolved multiple TypeScript errors and missing dependency issues to ensure a healthy production build.

## 1.1.2 – 2026-05-14

- **Fix**: Art Scraping — Resolved a ReferenceError in the Libretro fallback that caused art scraping to fail for many titles.
- **Fix**: Cheat Retrieval — Restored the missing `/api/roms/:id/fetch-cheats` route, allowing the UI to pull codes from the Libretro database.
- **Fix**: Cheat Toggling — Fixed a bug where enabling/disabling a cheat code would fail due to an incorrect database method name.
- **Fix**: API Consistency — Updated the scrape response format to match frontend expectations for immediate UI updates.

## 1.1.1 – 2026-05-14

- **Fix**: Corrected automatic art scraping and RetroAchievements settings lookup. Fixed a bug where incorrect field names were used to retrieve service credentials, which prevented automatic art fetching during upload and RA progress tracking.

## 1.1.0 – 2026-05-14

- **Modular Architecture**: Retired the 5,500-line monolithic `server/routes.ts` in favour of 13 specialized route modules under `server/routes/`. This significantly improves maintainability and developer velocity.
- **Enhanced Data Integration**: Refactored the `gamelist.xml` parser (supporting EmulationStation and LaunchBox formats) to extract enriched metadata, including star ratings, play counts, and last-played timestamps.
- **Improved Test Isolation**: Implemented lazy database initialization and per-test data directory logic, achieving 100% passing tests with zero shared-state pollution.
- **Multi-Architecture Support**: Updated `Dockerfile` to support both AMD64 and ARM64 (aarch64) base images automatically.
- **Bug Fix**: Restored missing `/api/kiosk` public configuration route.
- **Bug Fix**: Resolved gamepad binding leak between Player 1 and Player 2.

## 0.7.38 – 2026-05-13

- Feature: **Internationalization (i18n)** – language switcher added to Settings → Display; supports English, Español, Français, Deutsch, Português, 日本語, and 中文 (Simplified); selection is persisted server-side via IntegrationConfig and applied instantly across the UI via react-i18next; locale JSON files live in `client/src/locales/`

## 0.7.37 – 2026-05-11

- Feature: **Netplay lobby UI** — "Netplay" button (id=`cabinet-netplay-open`) in the game detail dialog action row; opens a lobby showing all open rooms on this server (5s poll); host creates a new 6-char room code with one click; join by code input or by clicking any listed room; hosting view displays the code prominently with copy button and pulses when a friend joins; player launches automatically as host or client; run `node server/apply-netplay-lobby-patch.mjs` once from `cabinet_bridge/` to activate
- API: `GET /api/netplay/rooms` — returns open (waiting) rooms as `{ code, createdAt }[]`

## 0.7.36 – 2026-05-11

- Feature: **ROM scanner** — set `CABINET_ROM_WATCH_DIR` in the HA add-on environment to auto-import ROM files dropped into a folder; polls every 60 seconds; system detected from extension (nes/snes/genesis/n64/gb/gbc/gba/nds/ps1/ps2/psp/dreamcast/arcade); Settings → Library shows watch dir, last scan time, total imported, and a "Scan now" button; run `node server/apply-scanner-patch.mjs` once from `cabinet_bridge/` to activate
- API: `GET /api/scanner/status`, `POST /api/scanner/scan-now`

## 0.7.35 – 2026-05-11

- Feature: **Smart filter collections** — dynamic collections that auto-populate from rules; create in Settings → Library with system pill toggles, play status filters, min rating, min playtime, genre keyword, and favorites-only switch; stored as JSON in `game_collections.smart_filter`; re-evaluated live on every `listCollections()` call; run `node server/apply-smart-filter-patch.mjs` once from `cabinet_bridge/` to activate
- API: `POST /api/collections/smart` (create), `PATCH /api/collections/:id/smart` (update rules)

## 0.7.34 – 2026-05-11

- Feature: **Appearance tab in Settings** — dedicated Settings → Appearance tab with 18 themes grouped by era (Base / 80s / 90s / Early 2000s); each card shows a tri-colour swatch and "Active" badge; theme moves out of General to its own tab; run `node server/apply-settings-appearance-patch.mjs` once from `cabinet_bridge/` to activate

## 0.7.33 – 2026-05-11

- Feature: **Play status badge on game cards** — colored dot next to system name: amber = Playing, green = Beaten, purple = Completed; hidden when status is Unset
- Feature: **Live play timer** — fixed pill in the top-right corner of the emulator overlay ticks mm:ss (then h:mm:ss) from the moment the game boots; run `node server/apply-overlay-patches.mjs` once from `cabinet_bridge/` to activate
- Feature: **Sync timestamp on save panel** — ☁ Sync button now shows "Last synced: Xm ago" next to it, persisted across sessions via localStorage; same patch script above
- Test: expanded `routes.test.ts` — coverage for P1/P2 controls port routing, gamepadRumble, systemDisplay schema validation, profile creation

## [0.7.0] – 2026-05-08

### Changed
- **Material Design 3 full overhaul** — complete alignment to the MD3 design system (m3.material.io) while preserving the dark gaming aesthetic
- **Color system** — MD3 color roles: primary/secondary/tertiary containers, surface container levels (lowest → highest), on-container text roles; dark theme uses tonal elevation overlays (primary-tinted surfaces)
- **Shape scale** — MD3 shape scale: extra-small 4px · small 8px · medium 12px (new default radius) · large 16px · extra-large 28px; all cards, dialogs, and chips updated
- **Type scale** — full MD3 type scale tokens (Display, Headline, Title, Body, Label with correct sizes, weights, and letter-spacing);  utility classes available
- **State layers** — replaced box-shadow elevation with MD3 state layers (): 8% hover, 12% press/focus, 16% drag; tinted to current-color for correct on-surface contrast
- **Navigation Drawer** — sidebar rebuilt to MD3 Navigation Drawer: active items use a 56 × pill-shaped primary-container indicator, section headers use Label Small, icon tinted to primary when active
- **Navigation Bar** — mobile bottom nav rebuilt to MD3 Navigation Bar: active tab has indicator pill under icon (primary-container), Label Small style, active icon tinted primary
- **Game Cards** — updated to MD3 Elevated Card: 16px large shape (rounded-xl), tonal surface (surface-container), Level-1 shadow, state layer on hover/press, borderless elevated style
- **Favorite button** — MD3 Tonal Icon Button: primary-container fill when active, rounded-full shape
- **Tailwind config** — Tailwind border-radius overrides updated to MD3 scale; new color tokens: , , , , 

# Changelog

## 0.6.1

- Feature: **Gamepad button remapper** — Settings → Controls now has a Gamepad Mapping section; plug in any controller and click a RetroArch button then press the physical button to map it; mappings saved per profile and applied at game launch via EJS_defaultControls value2 field
- Defaults auto-loaded for standard Xbox/PS layout (no setup needed for common controllers); Reset button restores defaults

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
