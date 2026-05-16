# Changelog

All notable changes to HomeArcade are documented here.

---

## [1.2.0] — 2026-05-15

### Major: Professional Shadcn Navigation

- **Persistent Sidebar** — Migrated the custom navigation to the professional Shadcn UI Sidebar foundation. The sidebar is now a top-level component that stays consistent during page transitions.
- **Collapsible Mode** — Added support for "Icon Mode" (collapsing the sidebar to icons only), providing significant extra screen space for game grids on desktop.
- **Keyboard Shortcuts** — Integrated native keyboard support (Cmd+B / Ctrl+B) to toggle the sidebar instantly.
- **Improved Hierarchy** — Refined the organization of systems, collections, and library filters for a cleaner, more intuitive browsing experience.
- **Glassmorphic Refinement** — Maintained and polished the backdrop-blur effects across the new navigation primitives.

---

## [1.1.19] — 2026-05-15

### Fix: Final Localization Cleanup

- **Missing Keys** — Restored missing translation keys for "Status breakdown" on the Dashboard and the "System Library" headings on the Home page, resolving the final remaining raw translation keys.
- **Global Sync** — Re-synchronized all 7 supported languages to ensure 100% translation coverage across the entire app.

---

## [1.1.18] — 2026-05-15

### Fix: UI Translation Mismatches

- **Corrected Keys** — Fixed missing translation keys for Dashboard game counts and "See All" links, resolving issues where raw code keys were visible in the UI.
- **Language Sync** — Fully synchronized the new keys across all 7 supported languages.

---

## [1.1.17] — 2026-05-15

### Polish: Tactile UI Feedback

- **Card Hover Effects** — Added a high-end "tilt-scale" and primary-colored glow effect to game cards on hover. This provides tactile, console-like feedback when browsing with a mouse.
- **Glassmorphism Refinement** — Further tuned the sidebar and navigation blur levels for optimal legibility across all 18 themes.

---

## [1.1.16] — 2026-05-15

### Feature: Cinematic Glassmorphism

- **Glassmorphic Navigation** — Applied a semi-transparent `backdrop-blur-md` effect to the Sidebar and Mobile Bottom Nav, allowing theme colors to bleed through for a more cohesive, high-end feel.
- **Staggered Animations** — Integrated `framer-motion` staggered entrance animations for all Bento Grid modules, creating a premium "app boot" experience when opening the Dashboard.
- **Visual Refinements** — Tuned the Hero section and navigation pill indicators for better contrast and legibility in glassmorphic mode.

---

## [1.1.15] — 2026-05-15

### Feature: "Bento Box" Dashboard

- **Modular Grid** — Completely redesigned the Dashboard using a responsive 12-column Bento Box layout. Content is now organized into cinematic, glassmorphic widgets that adjust perfectly to any screen size.
- **Cinematic Hero** — Enhanced the "Continue Playing" hero with a slow Ken Burns-style zoom effect on artwork and improved information hierarchy.
- **Glassmorphism Styling** — Applied a unified `backdrop-blur` and semi-transparent background to all dashboard modules for a high-end, modern gaming feel.
- **Improved UX** — Refined the Recent Activity list and Highlight cards to better utilize screen space and provide easier navigation.

---

## [1.1.14] — 2026-05-15

### Major: Full Localization Support

- **I18n Architecture** — Fully internationalized the application by replacing all hardcoded English strings with dynamic translation keys.
- **Settings Overhaul** — Localized the entire Settings page, including all tabs, field labels, and hint text.
- **Dashboard & Home** — Localized all stats cards, section headers, search placeholders, and sort options.
- **Multi-language Support** — Synchronized translations across all 7 supported languages (English, Spanish, French, German, Portuguese, Japanese, Simplified Chinese).

---

## [1.1.13] — 2026-05-15

### Polish: Priority Rendering

- **Above-the-fold Optimization** — Applied the `priority` flag to game cards in the Dashboard shelves (In Progress, Recently Played) and the Home page "Jump Back In" section. These items now bypass lazy-loading and use high-priority fetching to ensure the top of the app is always instantly interactive.

---

## [1.1.12] — 2026-05-15

### Feature: Performance & Mobile Optimization

- **Grid Virtualization** — Implemented Intersection Observer for library game cards. Content only renders when in or near the viewport, significantly reducing memory and CPU usage for large collections.
- **Image Priority Loading** — The first 10 items in any grid now use high fetch priority and eager loading to improve initial paint times.
- **Polling Efficiency** — Optimized background polling for "Now Playing" status. Frequency is reduced when idle and paused entirely when the browser tab is hidden.
- **Touch Optimizations** — Disabled auto-playing video previews on touch devices to conserve bandwidth and battery life.
- **Scroll Restoration** — Added automatic scroll management to ensure smooth navigation between the library and other pages.

---

## [1.1.11] — 2026-05-15

### Feature: Theme Visual Polish

- **Win95 Aesthetics** — Added iconic beveled borders to cards, sidebars, and buttons for the Win95 theme.
- **Gameboy DMG Filter** — Implemented a dot-matrix texture overlay and a specialized sepia-green image filter for that classic handheld screen look.
- **Synthwave Glow** — Added neon text shadows and glows to primary UI headers.
- **Arcade Scanlines** — Introduced a subtle scanline overlay for library cards in the Arcade theme.
- **Cyberpunk Sharpness** — Applied high-contrast, zero-radius angular clipping to the Cyberpunk aesthetic.
- **OLED Optimization** — Refined OLED theme with true-black backgrounds and sharper borders.

---

## [1.1.10] — 2026-05-15

### Fix: UI Themes

- **Specificity Fix** — Updated theme CSS selectors to ensure they correctly override the default dark mode variables. Themes like Vaporwave and Gameboy will now apply instantly when selected.
- **Integration Layer** — Synchronized the frontend integration layer with the new theme schema to ensure settings are correctly handled in the state.

---

## [1.1.9] — 2026-05-15

### Fix: Emulator Bootstrap

- **Loader Logic** — Resolved "bootstrap.js blocked" error by correctly passing global display settings to the emulator loader script.
- **Variable Scope** — Fixed a ReferenceError that prevented the dynamic generation of the emulator loading sequence.

---

## [1.1.8] — 2026-05-15

### Feature: 18 UI Themes

- **Thematic Styles** — Implemented full CSS definitions for 18 diverse aesthetics including Synthwave, Gameboy, OLED, Cyberpunk, and Win95.
- **Performance Cleanup** — Removed unused adaptive background CSS to streamline the main stylesheet and improve rendering speed.

---

## [1.1.7] — 2026-05-15

### Fix: Crash Recovery

- **Import Fix** — Resolved a white screen crash caused by a missing `useIntegration` import in the Dashboard component.

---

## [1.1.6] — 2026-05-15

### Fix: Application Boot

- **Logic Restoration** — Restored essential library management code that was accidentally omitted during the display settings refactor.
- **Dependency Isolation** — Broke a circular dependency between Settings and App modules by moving theme definitions to a dedicated shared utility.

---

## [1.1.5] — 2026-05-15

### Major: Enhanced Display & i18n Sync

- **Per-System Overrides** — Users can now set custom Aspect Ratios, Shaders, and Integer Scaling for each gaming system individually.
- **Global Preferences** — Added global fallback settings for aspect ratio and shaders.
- **System Labels Toggle** — New option to hide console names on game cards for a cleaner library aesthetic.
- **Translation Sync** — Fixed a bug where changing the language in Settings would not immediately update the UI; translations now sync instantly via `LanguageManager`.

---

## [1.1.2] — 2026-05-14

### Fix: Scraping & Cheats Restoration

- **Art Scraping Fix** — Resolved a ReferenceError in the Libretro fallback that caused art scraping to fail for many titles.
- **Cheat Retrieval** — Restored the missing `/api/roms/:id/fetch-cheats` route, allowing the UI to pull codes from the Libretro database.
- **Cheat Toggling** — Fixed a bug where enabling/disabling a cheat code would fail due to an incorrect database method name.
- **API Consistency** — Updated the scrape response format to match frontend expectations for immediate UI updates.

---

## [1.1.1] — 2026-05-14

### Fix: Automatic Scraping & RetroAchievements

- **Settings Lookup** — Fixed a bug where service credentials (ssUserId, ssPassword, raUsername, raToken, tgdbApiKey) were being retrieved using incorrect property names in the new modular routes. This restoration fixes automatic art fetching during upload and RetroAchievements progress tracking.

---

## [1.1.0] — 2026-05-14

### Major: Modular Architecture & Enhanced Data Integration

- **Modular Backend** — Retired the 5,500-line monolithic `server/routes.ts` in favour of a clean, specialized module structure under `server/routes/`. This significantly improves maintainability and allows for faster feature development.
- **Enriched Metadata** — The `gamelist.xml` parser now correctly extracts star ratings, play counts, and last-played timestamps for both EmulationStation and LaunchBox formats.
- **Robust Test Isolation** — Implemented lazy database initialization and per-test data directory logic. All 135 integration tests now pass with zero shared-state pollution.
- **Multi-Arch Docker** — Updated the `Dockerfile` to automatically support both AMD64 and ARM64 (aarch64) base images, ensuring a seamless experience on Raspberry Pi 4/5.
- **Public Kiosk Fix** — Restored the missing `/api/kiosk` public configuration route, fixing 404 errors in kiosk mode.
- **Gamepad Isolation Fix** — Resolved a bug where Player 1's bindings would leak into Player 2's empty configuration.

---

## [0.7.39] — 2026-05-11

### Fix: Lovelace card download

- **Public Assets** — Moved `homearcade-card.js`, `manifest.json`, and `sw.js` to a proper `public` directory to ensure they are correctly bundled by Vite.
- **Ingress Support** — Fixed the download link in Settings to be relative, allowing it to work correctly behind Home Assistant Ingress.
- **Port Updates** — Updated setup examples to use the default add-on port (5000).

---

## [0.7.38] — 2026-05-11

### Release

- Bump version to trigger Home Assistant update

---

## [0.7.37] — 2026-05-11

### Feature: Netplay lobby UI

- **New Netplay Lobby** — Create or join rooms via the library header. View active rooms, join with a code, and see player counts.
- **Room Management** — Host can see room code and share it; joining is seamless via the "Join Room" dialog.

---

## [0.7.36] — 2026-05-11

### Feature: ROM scanner

- **Auto-import ROMs** — New "Scanner" tab in Settings allows you to point to a folder on the host and automatically import games into the library.
- **Background Watcher** — Optional toggle to watch for file changes and update the library in real-time.

---

## [0.7.35] — 2026-05-11

### Feature: Smart filter collections

- **Dynamic Collections** — Create game lists based on rules (e.g., "System is NES AND Genre is Platformer").
- **Automatic Updates** — New games matching the filters are added to the collection automatically.

---

## [0.7.34] — 2026-05-11

### Feature: Appearance settings

- **Theme Picker** — New tab in Settings for changing the global UI theme (Default, Synthwave, Game Boy, OLED, etc.) without page reload.

---

## [0.7.33] — 2026-05-11

### Feature: Play status & Live timer

- **Play Status Badges** — "Playing", "Beaten", and "Completed" badges now appear on game cards to help track your backlog.
- **Live Play Timer** — Total play time now updates in real-time while you're in a game.

---

## [0.7.32] — 2026-05-10

### Feature: save state auto-sync from server

- **On game load**, after the emulator is ready, `cabinetAutoSyncFromServer` scans server backups and compares against local IDBFS. Any slots that exist on the server but are missing locally (new browser, cleared IndexedDB) are silently restored. A toast confirms: "☁ Synced N save states from server"
- **Does not overwrite** local saves — only restores slots that are genuinely absent in IDBFS, so intentional local-only states are preserved
- **"☁ Sync from server" button** added to the bottom of the Save-state Manager panel for manual on-demand sync
- Click handler wired to same `cabinetAutoSyncFromServer` function (idempotent — skips slots already present)
- Note: auto-backup to server on each save was already in place since v0.7.26; this release closes the restore side of the sync loop

---

## [0.7.31] — 2026-05-10

### Feature: controller haptics + per-system display options

**Controller haptics**
- New toggle in Settings → Controls: "Gamepad rumble / vibration"
- Stored as `gamepadRumble` in integration settings, applied at game launch
- When disabled, overrides `vibrationActuator` to suppress all rumble events

**Per-system display options**
- New section in Settings → Controls: "Display Options" — one row per system
- Three overrides per system: **Aspect ratio** (Default / 4:3 / 3:2 / 16:9 / 1:1), **Integer scale** (pixel-perfect rendering), **Shader** (None / CRT / Scanlines / Grayscale)
- Options stored in `systemDisplay` integration setting and injected into the bootstrap JS; applied via CSS on canvas after `EJS_emulator_ready`
- Shader value forwarded to `EJS_defaultOptions["shader"]` for EmulatorJS to apply

---

## [0.7.30] — 2026-05-10

### Feature: play time on game cards

- **Game cards now show total play time** — a clock icon + formatted duration (e.g. `2h 34m`, `45m`) appears in the card footer when a game has been played. Takes priority over last-played date; falls back to last-played if no time has been accumulated yet.
- Bulk art scrape and per-game stat display were already fully implemented in prior builds; confirmed working.

---

## [0.7.29] — 2026-05-10

### Feature: sort/filter persistence + video previews in game detail

- **Sort order and genre filter now persist across page loads** — stored in `localStorage` (`ha-sort`, `ha-genre`); picks up exactly where you left off
- **Video preview in game detail dialog** — hover the box art to reveal a ▶ Preview button; clicking it plays the ScreenScraper video clip inline, muted and looping. A "Box art" toggle switches back. Resets automatically when opening a different game.

---

## [0.7.28] — 2026-05-10

### Feature: 2-player controller support

- Added **Player 1 / Player 2** pill toggle at the top of Settings → Controls
- All keyboard bindings and gamepad mappings below the toggle apply to the selected player port
- P2 keyboard bindings stored under `{core}_p2` key; P2 gamepad bindings under `default_p2`
- All control API endpoints (`GET/PUT/DELETE /api/profiles/:id/controls/:core` and `/api/profiles/:id/gamepad-bindings/:gamepadId`) now accept `?port=0|1` query param
- Bootstrap JS fetches both P1 and P2 bindings at game launch — `EJS_defaultControls` is populated with `{ 0: p1Controls, 1: p2Controls, 2: {}, 3: {} }` so EmulatorJS wires up each player's gamepad automatically
- P2 controls section omitted from `EJS_defaultControls` when no P2 bindings have been saved, preserving existing single-player behaviour

---

## [0.7.27] — 2026-05-10

### Fix: save-state thumbnails no longer black

- `cabinetCaptureThumb` now calls `emulator.screenshot()` first — EmulatorJS's built-in method bypasses the WebGL `preserveDrawingBuffer=false` restriction that caused `drawImage()` on the game canvas to always return a black frame
- Falls back to direct canvas read for 2D-rendered cores
- Screenshots from `emulator.screenshot()` are resized down to thumbnail dimensions before upload

---

## [0.7.26] — 2026-05-10

### Fix: save-state backup now reliably reads from IDBFS

- `cabinetBackupSlot` was hardcoding `/{gameId}-{slot}.state` as the IDBFS path, but EmulatorJS path format varies by core — causing "No save data in slot N to back up" even when a save existed
- Now tries multiple candidate paths and scans the IDBFS root for any file matching the slot number pattern before giving up
- Added 800ms delay before the auto-backup after Save so EmulatorJS has time to flush the state file to IDBFS before we attempt to read it

---

## [0.7.25] — 2026-05-10

### Mobile landscape: full-screen game with virtual pad overlaid

- Game canvas now fills `100dvh`/`100dvw` in landscape on mobile instead of splitting the viewport with the pad
- Virtual pad tray overlays the game with no background, border, or shadow so it floats cleanly over the content
- Tighter button sizing and safe-area inset adjustments for landscape layout
- Centering fix for game container (`display: flex`, `align-items: center`, `justify-content: center`)

---

## [0.7.24] — 2026-05-09

### Fix: cheats now actually apply to the emulator on launch

- Bootstrap now fetches enabled cheats for the ROM + active profile at launch time and injects them as `window.EJS_cheats` so the emulator core activates them from the start — previously cheats were stored in SQLite and shown in the UI but never passed to EmulatorJS
- Server-side duplicate guard on `POST /api/roms/:id/cheats` — returns 409 if a cheat with the same code already exists for this ROM + profile
- In-game Add button disables and shows "Adding…" while the request is in-flight; shows "Cheat already exists" toast on 409 instead of silently adding a duplicate

---

## [0.7.23] — 2026-05-09

### Fix: robust `.cht` parser for N64/PS1 split-field format

- Parser now handles both code styles found in the libretro database: combined (`cheatN_code = "8011E2B8+0064"`) used by SNES, GBA, and most systems; and split (`cheatN_address` + `cheatN_value`) used by older N64/PS1 files
- Split pairs are joined as `address+value` to match the combined format

---

## [0.7.22] — 2026-05-09

### Fix: full system coverage for cheat database

- Fixed key mismatches: `sms`/`gamegear` were incorrectly mapped as `master-system`/`game-gear`
- Added missing systems: Atari 2600, Atari 7800, Lynx, PC Engine, Neo Geo, Sega CD, Sega 32X, Virtual Boy, Dreamcast
- All 23 app systems now have cheat database mappings

---

## [0.7.21] — 2026-05-09

### Lazy SQLite cache for cheat database lookups

- Added `cheat_index_cache` and `cheat_file_cache` tables to schema
- First lookup per system fetches the libretro directory listing and caches it for 7 days; first lookup per game fetches and caches the `.cht` file for 30 days — all subsequent lookups are instant and work offline
- `DELETE /api/cheat-cache` endpoint to bust the cache
- Settings → Library: "Clear cheat cache" button

---

## [0.7.20] — 2026-05-09

### Fix: cheat fetch — Contents API with fuzzy title matching

- Replaced GitHub code search (unreliable with space-heavy paths) with the Contents API: list all `.cht` files in the system folder, then pick the best match by counting shared normalised title words with a bonus for prefix matches
- Works reliably for titles with special characters, subtitles, and regional variants

---

## [0.7.19] — 2026-05-09

### Auto-populate cheats from libretro database

- Database icon button next to the Cheats header in the game detail dialog fetches the matching `.cht` file from `libretro/libretro-database` on GitHub
- Shows a scrollable panel of available cheats with checkboxes; All/None shortcuts; "Add N cheats" imports selected codes into the game's cheat list with `enabled: true`
- Supports NES, SNES, N64, GBA, GBC, GB, Genesis, Game Gear, Master System, Saturn, PS1, PS2, PSP, NDS
- `GET /api/roms/:id/fetch-cheats` server endpoint

---

## [0.7.18] — 2026-05-09

### Collection management: inline create, rename, delete

- New collection input is now an inline autoFocus text field (Enter to save, Escape to cancel) — replaces `window.prompt`
- Settings → Library: new Collections section with rename (pencil icon, inline input) and delete (trash + confirm dialog) per collection; shows game count
- `PATCH /api/collections/:id` rename endpoint

---

## [0.7.17] — 2026-05-09

### Game card titles + post-upload art fetch

- Game title now appears as prominent text in the card footer so games are identifiable without hovering, especially on mobile where box art may be missing
- After a successful upload a "Fetch art for N ROMs" button appears in the success banner — clicking it runs scrape-art for each just-uploaded ROM and reports "Art fetched: X/N matched"

---

## [0.7.16] — 2026-05-09

### CSV history export + `homearcade_game_ended` improvements

- `homearcade_game_ended` now always includes `duration_seconds` — falls back to `(endedAt − sessionStart)` if the client didn't send it; also adds `duration_minutes` (rounded) for easier HA template use
- Export CSV button in the History header generates a client-side CSV with columns: Date, Time, Game, System, Duration (s), Duration (formatted); filename includes today's date

---

## [0.7.15] — 2026-05-09

### Per-game drill-down in History

- Click any session row or bar in the Top Games chart to drill into that game's full play history
- Drill-down shows: box art, title, system, and a stat grid (total playtime, session count, average session length, first played); below that, every individual session with date, time, and duration
- Back button returns to the full history view; derived client-side from already-loaded data — no extra API calls

---

## [0.7.14] — 2026-05-09

### Live Now Playing indicator

- Sidebar polls `/api/now-playing` every 5s and shows a pulsing dot with the game title between the logo and nav items when a game is running
- Dashboard shows a Live banner above the Continue Playing hero with a pinging dot, game title, system, and a Details shortcut; fades in box art as a background wash if available

---

## [0.7.13] — 2026-05-09

### Search improvements

- Press `/` or `Cmd+K` anywhere in the library to focus the search box; Escape clears and blurs; inline × button clears
- Search now scans all games regardless of active system/collection filter
- Match includes developer and publisher fields in addition to title, genre, and system
- Result notice bar shows scope and count ("Searching all 284 games — 3 results") with a Clear shortcut

---

## [0.7.12] — 2026-05-09

### Controls tab: active profile sync + modified indicator

- Controls tab in Settings now defaults to the currently active profile and stays in sync if you switch profile while Settings is open
- Modified bindings show a coloured dot next to the label and a tinted border on the button
- Active profile gets an "active" badge in the selector
- Removed the fake "Global" sentinel that was colliding with Player 1's ID

---

## [0.7.11] — 2026-05-09

### Cheat code manager in game detail dialog

- Cheats section in GameDetailDialog: inline add form (description + code, Enter to submit), toggle on/off per cheat, two-step delete confirm, active/total count in header
- Cheats are profile-scoped

---

## [0.7.10] — 2026-05-09

### Save state thumbnails in game detail dialog

- Game detail dialog queries `/api/roms/:id/save-states` and renders a card per slot showing the thumbnail, slot label, and relative save time
- Hover to reveal a two-step delete button; falls back to a Save icon if no thumbnail exists

---

## [0.7.9] — 2026-05-09

### Profile switcher moved to sidebar footer

- `ProfileContext` / `useProfile` hook shares profile state across the app
- Profile switcher moved from library header to sidebar footer for persistent access

---

## [0.7.8] — 2026-05-09

### `homearcade_game_started` event improvements

- Added `art_url` and `release_year` fields to the HA webhook payload so automations can display box art and year without extra lookups

---

## [0.7.7] — 2026-05-09

### Fix: physical gamepad stops responding after ~60s

- Replaced the EmulatorJS gamepad keep-alive with a custom polling loop using `requestAnimationFrame` so the browser never suspends gamepad reads during controller-only sessions

---

## [0.7.2] — 2026-05-09

### 10 era-themed colour schemes

- Added 10 additional themes covering arcade, console, and handheld eras (e.g. Plasma Cabinet, Neo Geo Gold, Game Boy Pocket, Dreamcast Swirl)

---

## [0.7.1] — 2026-05-09

### Four new colour themes

- Midnight Arcade, Famicom Red, Game Boy Green, and CRT Phosphor added to the theme picker

---

## [0.7.0] — 2026-05-09

### Material Design 3 full overhaul

- Complete MD3 colour system: primary/secondary/tertiary container roles, 5-level surface containers, tonal elevation overlays for dark theme
- MD3 shape scale (xs=4px → xl=28px) and full type scale (Display/Headline/Title/Body/Label)
- MD3 state layers replace box-shadow elevation with opacity colour overlays
- Navigation Drawer: active item uses pill-shaped primary-container indicator
- Navigation Bar: MD3 bottom nav with indicator pill under active icon
- Game Cards: MD3 Elevated Card with tonal surface, Level-1 shadow, state layers
- Tailwind config updated with new colour tokens

---

## [0.6.1] — 2026-05-09

### Gamepad button remapper

- Settings → Controls: press-to-capture remapper for connected gamepads; click a RetroArch button name then press a physical button to bind it
- Buttons grouped by Face / System / D-Pad / Shoulder / Analog
- Per-profile: saves to `/api/profiles/:profileId/gamepad-bindings/default`; falls back to standard Xbox/PS layout
- Player bootstrap merges custom gamepad bindings into `EJS_defaultControls`
- Schema: `gamepad_bindings` table

---

## [0.6.0] — 2026-05-09

### TheGamesDB scraper, History page, per-profile game state & key bindings, mobile touch polish

- **TheGamesDB** as primary metadata source (art, description, genre, developer, publisher) with cascade fallback to ScreenScraper → Libretro thumbnails; API key field in Settings → Services
- **Play History page** (`/history`): sessions grouped by day, Top-5 games bar chart, total playtime / most-played / last-session stats
- **Per-profile favorites, ratings, and play status** — `profile_game_state` table; non-default profiles get isolated state
- **Per-profile key bindings** — `profile_control_bindings` table; Settings → Controls: profile selector above system tabs; player bootstrap merges global defaults + profile overrides
- **Mobile touch polish**: `touch-action: manipulation` eliminates 300ms tap delay; `overscroll-contain` on scroll containers; landscape pad compression

---

## [0.5.3] — 2026-05-09

### Upload progress bar

- Real-time per-file and overall progress bars during ROM upload (switched from `fetch` to `XMLHttpRequest` for upload progress events)
- Upload button shows live percentage; file list hidden during upload

---

## [0.5.2] — 2026-05-09

### Fix: bootstrap.js syntax error breaking game launch

- Fixed syntax error introduced in 0.5.1 that prevented any game from loading

---

## [0.5.1] — 2026-05-09

### Working netplay via WebSocket relay

- Netplay now routes through the server's WebSocket relay instead of direct peer connections, making it work through HA Ingress

---

## [0.5.0] — 2026-05-09

### Named profiles, cheats panel, Scanlines/LCD/Phosphor shaders

- **Named player profiles**: create/delete in Settings → Player Profiles; switcher in library header; save states, cheats, and key remaps isolated per profile
- **Cheats panel**: slide-in panel with add/toggle/delete cheat codes, scoped to game + active profile
- **Three new shader presets**: Scanlines, LCD, Phosphor (green monochrome glow)

---

## [0.4.12] — 2026-05-09

### Fix: aspect ratio and filter controls now work

- CSS `!important` overrides added to beat EmulatorJS inline canvas styles that were silently ignoring filter/aspect ratio changes

---

## [0.4.11] — 2026-05-09

### Systems sorted by release date

- System tiles on the home screen now appear in chronological era order

---

## [0.4.0] — 2026-05-09

### Cloud saves, Activity Feed, multi-disc support

- Server-side save state backups survive browser clears and device switches
- Dashboard Activity Feed showing recent play sessions
- Multi-disc PS1 support: `.cue`/`.bin` sets with matching filenames grouped automatically; disc-swap menu appears during play

---

## [0.3.33] — 2026-05-09

### Description previews, video hover, 6 more systems

- Game cards show synopsis on hover; list view shows truncated description as a third line
- Box art hover plays a muted looping video clip if ScreenScraper returned a video URL
- New systems: Sega 32X, Sega CD, Neo Geo, Virtual Boy, Atari 7800, Atari Lynx

---

## [0.3.32] — 2026-05-09

### 5 new systems, CRT quick-toggle, auto-save on visibility change, session history

- New systems: Atari 2600, Sega Saturn, Game Gear, Master System, TurboGrafx-16
- CRT filter quick-toggle button in the in-game menu
- Tab hide (`visibilitychange`/`pagehide`) triggers auto-save to slot 0; next game load detects and offers to restore
- `play_sessions` table and Recent Activity feed on the dashboard (last 12 sessions with title, system, duration, relative time)

---

## [0.3.31] — 2026-05-09

### System thumbnail improvements

- Silhouette watermark + logo overlay + scanline + sheen + vignette layers on system tiles

## [0.3.18] — 2026-05-07

### Mobile: Settings page responsive improvements

- **Tab bar**: 3-column grid on mobile (two rows of three), switches to flex-wrap on sm+; tab labels shrink to `text-xs` on small screens
- **Launch endpoints table**: on mobile the endpoint URL collapses under the game title instead of appearing as a separate column; header hides the Endpoint column heading
- **Controls console selector**: tighter `px-2 py-1` padding and `text-[10px]` on mobile so all system buttons comfortably wrap
- **Binding rows**: reduced horizontal padding on small screens
- **Main content area**: `px-4` on mobile (was `px-5`) to give a touch more breathing room
- **HA Setup code blocks**: explicit `max-w-full` so long YAML lines scroll horizontally without pushing the page layout

---

## [0.3.17] — 2026-05-07

### Fix: save-state manager now shows only the logged-in user's saves

The save slot metadata (labels, timestamps, slot numbers) was stored in the database keyed only by `romId + slot`, so all HA users could see each other's occupied slots in the Save Manager even though the actual emulator save files were already isolated via `EJS_gameID` scoping. This release adds a `userId` column to `rom_save_slots` and scopes all three endpoints (list, upsert, delete) to the requesting user. Existing rows in the old format default to `"default"` and remain accessible to all users until re-saved.

---

## [0.3.16] — 2026-05-07

### Per-user save states (Home Assistant multi-user support)
- **Automatic user detection** — reads HA Ingress headers (`X-Remote-User-Id`, `X-Remote-User-Name`) on every player request; falls back to `"default"` for local dev
- **Scoped `EJS_gameID`** — each user's EmulatorJS IDBFS storage key is prefixed with their HA user ID, so browser-local save states, SRAM, and memory cards are siloed per user automatically
- **Per-user server-side backup paths** — save backup files are now stored under `save-backups/<userId>/<romId>/slot-N.state`; existing backups in the flat layout will no longer appear (migrate manually if needed)
- **`/api/current-user` endpoint** — returns `{ userId, userName }` for the logged-in HA user; useful for client-side display and debugging
- **Username badge in player menu** — the in-game menu now shows a pill badge with the logged-in user's display name (hidden for the default/local-dev user)
- **Save manager user label** — the Save Slots panel subtitle now shows whose saves are being managed

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
