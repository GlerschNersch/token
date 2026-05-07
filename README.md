# HomeArcade

Retro gaming frontend for Home Assistant. Runs as a Home Assistant add-on so the
sidebar gains a **Cabinet** panel for browsing systems, launching games via HA
webhooks, and managing your own uploaded ROMs.

The add-on bundles both the React UI and the Express backend that handles ROM
uploads, settings persistence, metadata scraping, and the system-image cache.
All persistent state lives under the supervisor-managed `/data` volume so it
survives add-on restarts and updates.

**Current version: 0.2.0**  
GitHub: <https://github.com/GlerschNersch/token>

---

## Supported systems

| System | Core | File types |
| --- | --- | --- |
| NES | nestopia | `.nes`, `.zip`, `.7z` |
| SNES | snes9x | `.smc`, `.sfc`, `.zip`, `.7z` |
| Nintendo 64 | mupen64plus | `.n64`, `.z64`, `.v64`, `.zip`, `.7z` |
| Game Boy | gambatte | `.gb`, `.zip`, `.7z` |
| Game Boy Color | gambatte | `.gbc`, `.zip`, `.7z` |
| Game Boy Advance | mgba | `.gba`, `.zip`, `.7z` |
| Nintendo DS | melonds | `.nds`, `.zip`, `.7z` |
| Genesis / Mega Drive | segaMD | `.md`, `.bin`, `.smd`, `.zip`, `.7z` |
| PlayStation 1 | pcsx | `.cue`, `.bin`, `.iso`, `.zip`, `.7z` |
| PlayStation 2 | pcsx2 | `.iso`, `.bin`, `.zip`, `.7z` |
| PSP | ppsspp | `.iso`, `.cso`, `.pbp`, `.zip`, `.7z` |
| Dreamcast | reicast | `.cdi`, `.gdi`, `.chd`, `.zip`, `.7z` |
| Arcade (MAME) | mame2003 | `.zip`, `.7z` |

---

## Install (Home Assistant add-on)

1. In Home Assistant: **Settings → Add-ons → Add-on Store → ⋮ (top right) →
   Repositories**.
2. Paste the repository URL and click **Add**:

   ```
   https://github.com/GlerschNersch/token
   ```

3. Close the dialog, scroll to the **HomeArcade Add-ons** section in the
   store, and open **HomeArcade**.
4. Click **Install**. Home Assistant Supervisor will build the image (this can
   take several minutes on the first install).
5. When the install finishes, click **Start**. With **Show in sidebar** enabled
   the panel appears as **Cabinet** in the HA sidebar; you can also open it from
   the add-on page via **Open Web UI**.

The add-on listens on port 5000 internally and is exposed through Home
Assistant Ingress, so no external port forwarding or reverse-proxy work is
required.

There are no add-on options to configure — connection settings (HA base URL,
long-lived token, endpoint overrides, Live mode) are managed inside the panel
itself at **Settings**, and are persisted to the add-on's SQLite database.

### PWA install

HomeArcade ships a web app manifest and service worker. On supported
browsers (Chrome, Edge, Safari 16.4+) you can install it as a standalone app:

- **Desktop (Chrome/Edge):** click the install icon (⊕) in the address bar.
- **iOS (Safari):** tap Share → **Add to Home Screen**.
- **Android (Chrome):** tap the browser menu → **Add to Home Screen**.

The installed app works offline for already-cached assets and shows a
home-screen icon. API calls (ROM lists, uploads, game launch) still require
the add-on to be running.

---

## Updating the add-on

1. **Settings → Add-ons → ⋮ → Check for updates** (top-right of the add-on
   store).
2. Open **HomeArcade**. If a newer version is available, an **Update**
   button appears at the top of the page — click it.
3. If you don't see an update button but expect one, also try:
   - **Settings → Add-ons → HomeArcade → ⋮ → Rebuild** to force a fresh
     build of the current version.
   - Reload the page with a hard refresh (Ctrl/Cmd-Shift-R) so the browser
     drops cached JS/CSS from the previous version.

> **Maintainers:** any change that should ship to users must bump
> `version:` in `cabinet_bridge/config.yaml`. Home Assistant compares that
> string against the installed version, and will not surface an update prompt
> if it hasn't changed — even if you've pushed new commits.

---

## Persistent data

Everything HomeArcade needs to remember lives under `/data` inside the
add-on container, which Home Assistant Supervisor persists across restarts,
updates, and rebuilds:

| Path | What it stores |
| --- | --- |
| `/data/data.db` | SQLite database: integration settings, ROM metadata, play stats, app state |
| `/data/rom-storage/` | Uploaded ROM files, organized by system slug |
| `/data/system-image-cache/` | Downloaded console artwork used by the Browse Systems tiles |
| `/data/save-backups/` | Server-side save-state backups (per-ROM, per-slot) |

If the `/data` volume is not writable (for example when running outside Home
Assistant), the backend falls back to `CABINET_DATA_DIR` if set, otherwise to
the current working directory.

---

## Uploading ROMs

> **The backend must run as the Home Assistant add-on for uploads to
> succeed.** Uploads write to `/data/rom-storage/` and are recorded in
> `/data/data.db`; both paths are only writable inside the Supervisor-managed
> add-on container.

Open the panel, click a system in the sidebar, and the system page shows an
"Upload ROMs" dropzone at the top. Drop files in or use **Browse ROM files**;
uploads are filed under that console automatically and the system's grid and
sidebar count refresh as soon as the upload finishes. Allowed extensions are
enforced server-side per system, including PS1 multi-track sets (`.cue`/`.bin`)
and archives (`.zip`, `.7z`).

The **All Games** view also has a dropzone, but you must pick a console there —
the upload isn't bound to a specific system page.

Each uploaded ROM is hashed with MD5 at upload time. The hash appears in the
game detail dialog and can be used to cross-reference ROM databases. It is also
stored in the database and exposed over the API.

### Upload size limits

Per-file uploads are capped at 2 GB by default — large enough for PS1 and most
PS2 disc images. Tune this through the `CABINET_MAX_UPLOAD_MB` env var when
running locally, and restart the add-on. The dropzone reads the live cap from
`/api/upload-limits` and refuses oversize files before sending them.

The add-on declares `ingress_stream: true` so Home Assistant streams large
upload bodies through ingress instead of capping them at the default 16 MB
limit. If you previously hit `413: Maximum request body size 16777216 exceeded`,
update or rebuild the add-on to pick up this config and try again.

### Importing ROM libraries

Instead of uploading files one at a time you can bulk-import metadata from
existing collection databases:

- **EmulationStation** — drop a `gamelist.xml` in **Settings → Import ROMs →
  EmulationStation**. HomeArcade reads each `<game>` element and adds matched
  entries to your library. The ROM files themselves are not copied; only the
  metadata (title, description, genre, developer, publisher, release date, player
  count) is imported.
- **LaunchBox** — same flow with a LaunchBox XML export. HomeArcade reads
  `<Game>` elements from the file.

Both importers return a count of how many entries were successfully added.

### Troubleshooting uploads

- **"404: Not Found" when uploading under HA ingress.** The SPA detects the
  `/api/hassio_ingress/<token>/` prefix and routes API calls through it. If you
  still see a 404: make sure the add-on is **Started**, hard-refresh the panel,
  and check you're on the latest version.
- **Upload picker won't show your file on Android/iOS.** The current UI uses an
  unfiltered picker; allowed extensions are enforced after the file is chosen.
- **Upload appears to succeed but the ROM doesn't show up.** Reload the view;
  the list is fetched from `/data/data.db`, so a hard refresh after a successful
  upload guarantees a fresh read.

---

## Playing games

Click any game tile to open its detail dialog, then click **Play** to launch it
in the EmulatorJS in-browser emulator. The emulator boots in a full-screen
overlay.

### Save states

Use the **Save Manager** button in the emulator overlay to open the save-state
panel. You can create up to 4 slots; each slot shows a thumbnail captured at
save time and the date it was saved.

**Server-side backups** — each slot has a ☁ **Backup** button that uploads the
save to the add-on's `/data/save-backups/` directory, and a ↺ **Restore**
button that downloads the latest server backup for that slot back into the
in-browser storage. Backups survive browser clears, device switches, and
reinstalls. The save manager fetches the list of available server backups
automatically when opened.

### Gamepad support

Physical gamepads are detected automatically via the HTML5 Gamepad API. The
**Test Pad** button in the emulator menu opens a live visualization of every
connected controller — axes and buttons update in real time so you can confirm
mapping before you start playing.

**Key remapping** — the **Key Remap** panel lets you reassign any emulator
button to a physical key or gamepad button. Remaps can be saved as named
profiles per game and switched from a drop-down at the top of the remap panel.
Profiles are stored in `localStorage` and survive page reloads.

### Netplay

The **Netplay** button opens a room-based multiplayer session:

- **Host** — generates a room code and waits for a player to join.
- **Join** — enter a room code to connect to an existing session.

Netplay uses EmulatorJS's built-in peer connection and is best suited for
local-network play or fast connections.

---

## RetroAchievements

HomeArcade can display your RetroAchievements account stats and unlock
achievements as you play.

### Setup

1. Create a free account at [retroachievements.org](https://retroachievements.org).
2. In HomeArcade **Settings → RetroAchievements**, enter your username and
   API token (found on your RA profile page under **Settings → Keys**).
3. Save. The add-on stores the credentials in its database and injects them into
   the emulator at launch time.

### Dashboard

The **Achievements** page (trophy icon in the sidebar) shows:

- Hardcore and softcore point totals
- Global rank
- Recently played games with per-game achievement progress
- A list of recent unlocks with trophy icons and hardcore badges

The dashboard pulls live data from the RetroAchievements API; an internet
connection is required.

---

## Metadata scraping (ScreenScraper)

HomeArcade can fetch box art, screenshots, descriptions, and other metadata
from [ScreenScraper.fr](https://www.screenscraper.fr). Enter your ScreenScraper
username and password in **Settings → ScreenScraper**, then use the
**Refresh Art** action on any game to pull fresh data.

---

## Kiosk mode

Enable **Kiosk Mode** in Settings to lock the UI for public or shared setups:

- The Settings, Achievements, and system management pages are hidden.
- Optionally set a PIN — the PIN must be entered to exit kiosk mode.
- Optionally pin a specific game **Collection** — the kiosk shows only that
  collection's games.

Kiosk settings persist in the database and survive restarts.

---

## Library features

### Browsing

- **All Games** — flat list of every uploaded ROM across all systems.
- **System pages** — per-console views with a dropzone at the top.
- **Collections** — custom named lists. Create, rename, and delete collections
  from the Collections page; add games from the game detail dialog.
- **Recently Played shelf** — a horizontal strip on system and collection pages
  shows the most recently launched ROMs for that context.
- **Genre filter** — filter any view by genre (data pulled from ScreenScraper
  or imported from ES/LaunchBox metadata).
- **Sort options** — sort by title, play count, recently played, or upload date.

### Play statistics

Every launched session records its duration. The total **minutes played** for
each ROM accumulates in the database and is visible in the game detail dialog.

---

## Local development

The application source (React client, Express server, shared schema, build
config) lives inside [`cabinet_bridge/`](cabinet_bridge/) so that Home
Assistant Supervisor can build the add-on with that folder as the Docker
context. Run npm commands from there:

```bash
cd cabinet_bridge
npm install
CABINET_DATA_DIR=/tmp/cabinet-data npm run dev
```

The dev server listens on `http://localhost:5000`. Set `CABINET_DATA_DIR` to
any writable directory; without it the backend tries `/data` first and then
falls back to the current working directory.

To produce a production build (the same one the add-on ships):

```bash
cd cabinet_bridge
npm run build
NODE_ENV=production node dist/index.cjs
```

### Running tests

HomeArcade includes a Vitest integration test suite that spins up an
in-process Express server and exercises the API endpoints end-to-end:

```bash
cd cabinet_bridge
npm test
```

Tests use an isolated temporary database directory and clean up after
themselves. Run `npm run test:watch` to keep Vitest active during development.

---

## Repository layout

```
.
├── README.md              # this file
├── repository.yaml        # Home Assistant add-on repository manifest
└── cabinet_bridge/        # the add-on itself (Docker context)
    ├── config.yaml        # add-on manifest — bump `version` to ship updates
    ├── Dockerfile
    ├── run.sh
    ├── vitest.config.ts   # test configuration
    ├── client/            # React + Vite SPA
    │   ├── index.html     # includes PWA manifest link + SW registration
    │   ├── manifest.json  # PWA web app manifest
    │   ├── sw.js          # service worker
    │   └── src/
    │       ├── pages/     # Home, Settings, Achievements, Collections, …
    │       ├── components/# shared UI components
    │       └── lib/       # integration config, utilities
    ├── server/            # Express backend
    │   ├── routes.ts      # all API endpoints + emulator bootstrap JS
    │   ├── storage.ts     # SQLite/Drizzle ORM layer
    │   └── __tests__/     # Vitest integration tests
    └── shared/            # shared TypeScript schema (Zod + Drizzle)
```

---

## Links

- Repository: <https://github.com/GlerschNersch/token>
- Issues: <https://github.com/GlerschNersch/token/issues>
- RetroAchievements: <https://retroachievements.org>
- ScreenScraper: <https://www.screenscraper.fr>
- EmulatorJS: <https://emulatorjs.org>
