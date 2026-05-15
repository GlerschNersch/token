# HomeArcade

> Retro gaming, right inside Home Assistant.

HomeArcade is a Home Assistant Add-on that turns your sidebar into a full retro game library. Upload ROMs, browse by system, launch games in an in-browser emulator, track play time, earn RetroAchievements, and manage multiple player profiles — all without leaving Home Assistant.

**Current version: 1.1.2** · [Report a bug](https://github.com/GlerschNersch/token/issues/new) · [View source](https://github.com/GlerschNersch/token)

[![Venmo](https://img.shields.io/badge/Venmo-@vincusmalincus-3D95CE?style=for-the-badge&logo=venmo&logoColor=white)](https://venmo.com/vincusmalincus)

![HomeArcade library view showing Browse Systems, Favorites shelf, and the HA sidebar panel](docs/screenshots/homearcade-library.png)

---

## Quick start

**1. Add the repository**

In Home Assistant: **Settings → Apps → Add-ons → ⋮ → Repositories**, paste:
```
https://github.com/GlerschNersch/token
```

**2. Install and start**

Find **HomeArcade** in the store, click **Install**, wait for the build to finish (2–5 minutes), then click **Start**. Enable **Show in sidebar**.

**3. Upload a ROM and play**

Open HomeArcade from the sidebar, click a system (e.g. NES), drop a ROM file onto the upload zone, then click the game card → **Play**.

That's it. No port forwarding, no reverse proxy, no extra software.

---

## Supported systems

Systems are listed in release-date order.

| System | Core | Accepted formats |
|---|---|---|
| Arcade (MAME) | mame2003 | `.zip` |
| Atari 2600 | stella2014 | `.a26` `.bin` `.zip` |
| NES | nes | `.nes` `.zip` |
| Atari 7800 | prosystem | `.a78` `.bin` `.zip` |
| Sega Master System | smsgg | `.sms` `.zip` |
| TurboGrafx-16 / PC Engine | pce | `.pce` `.zip` |
| Genesis / Mega Drive | segaMD | `.md` `.bin` `.smd` `.zip` |
| Game Boy | gambatte | `.gb` `.zip` |
| Atari Lynx | mednafen_lynx | `.lnx` `.zip` |
| Game Gear | smsgg | `.gg` `.zip` |
| Neo Geo | fbneo | `.zip` |
| SNES | snes9x | `.smc` `.sfc` `.zip` |
| Sega CD | segaCD | `.cue+.bin` `.iso` `.chd` `.zip` |
| Sega 32X | picodrive | `.32x` `.bin` `.zip` |
| Saturn | yabause | `.iso` `.bin` `.zip` |
| PlayStation 1 | pcsx | `.cue+.bin` `.iso` `.pbp` `.chd` `.zip` |
| Virtual Boy | beetle_vb | `.vb` `.zip` |
| Nintendo 64 | mupen64plus | `.n64` `.z64` `.v64` `.zip` |
| Game Boy Color | gambatte | `.gbc` `.zip` |
| Dreamcast | reicast | `.cdi` `.gdi` `.chd` `.zip` |
| PlayStation 2 | pcsx2 | `.iso` `.bin` `.zip` |
| Game Boy Advance | mgba | `.gba` `.zip` |
| Nintendo DS | melonds | `.nds` `.zip` |
| PSP | ppsspp | `.iso` `.cso` `.pbp` `.zip` |

---

## Features

- **In-browser emulator** — powered by [EmulatorJS](https://emulatorjs.org); no plugins or installs needed
- **Save states** — up to 4 slots per game with thumbnail previews; server-side backup and restore
- **Player profiles** — named profiles with separate save states, cheats, and key remaps; switch profiles from the library header
- **Cheat codes** — add, toggle, and delete cheat codes per game per profile from the in-game Cheats panel
- **Display shaders** — None, CRT, Smooth, Scanlines, LCD, and Phosphor — all applied with CSS `!important` so they reliably override EmulatorJS canvas styles
- **Metadata scraping** — cover art, descriptions, genre, developer, and publisher from [TheGamesDB](https://thegamesdb.net) (primary, free API key) with [ScreenScraper.fr](https://www.screenscraper.fr) and Libretro thumbnails as fallback
- **Play History** — dedicated history page with sessions grouped by day, per-game playtime bar chart, and total playtime stats
- **RetroAchievements** — live achievement unlocks and a dashboard with your stats
- **Play time tracking** — minutes played per game, recently played shelf; per-profile favorites, ratings, and play status
- **Kiosk mode** — lock the UI with an optional PIN for shared or TV setups
- **Collections** — create custom game lists
- **Gamepad support** — plug in any USB or Bluetooth controller; test it live before playing
- **Key remapping** — reassign any button, save named profiles per game
- **Themes** — Default (dark), Synthwave, Game Boy, OLED
- **PWA** — install as a standalone app on phone, tablet, or desktop
- **Netplay** — room-based multiplayer over EmulatorJS peer connections
- **HA automation hooks** — fires `homearcade_game_started` / `homearcade_game_ended` events; `input_text.homearcade_now_playing` entity; Lovelace card

---

## Installation

### Requirements

- Home Assistant OS or Supervised (add-on support required)
- `amd64` or `aarch64` host architecture
- ~500 MB free space for the Docker image; more for ROMs

### Step-by-step

1. **Settings → Apps → Add-on Store → ⋮ (three dots, top right) → Repositories**
2. Paste `https://github.com/GlerschNersch/token` and click **Add**
3. Close the dialog and scroll to find **HomeArcade** in the store
4. Click **Install** — the first build takes 2–5 minutes (compiling native SQLite bindings)
5. Once installed, click **Start**
6. Toggle **Show in sidebar** on the add-on page
7. Click **Open Web UI** or select HomeArcade from the sidebar

> The app runs on port 5000 internally and is exposed via HA Ingress — no firewall rules or reverse-proxy configuration needed.

### Updating

When a new version is available, an **Update** button appears at the top of the HomeArcade add-on page. Click it — your ROMs, save states, and settings are preserved (they live in the Supervisor-managed `/data` volume, which is never touched during an update).

> **Rebuild vs Update:** "Rebuild" re-compiles the currently installed version from HA's local cache. "Update" pulls the latest code from GitHub and rebuilds — use this to get new features and bug fixes.

---

## Uploading ROMs

ROMs are stored in `/data/rom-storage/` and tracked in a SQLite database — both survive updates and restarts.

**How to upload:**
1. Click a system in the sidebar (e.g. "PlayStation 1")
2. Drop ROM files onto the upload zone, or click **Browse ROM files**
3. The game appears in the grid immediately after upload

**Tips:**
- PS1 multi-disc games: upload all `.bin` files plus the `.cue` sheet together
- ZIP archives are extracted automatically on the server
- Maximum file size: 2 GB per file (enough for PS2 ISOs)
- Rename ROM files to match the official game title for best ScreenScraper results

### Importing an existing library

If you have a RetroPie, Batocera, or EmulationStation setup, you can import metadata without re-uploading ROM files:

- **EmulationStation** — Settings → Import → EmulationStation → drop `gamelist.xml`
- **LaunchBox** — Settings → Import → LaunchBox → drop the LaunchBox XML export

Both importers add game metadata (title, description, genre, art URL) to your library. ROM files are not moved or copied.

---

## Playing games

1. Click any game card to open its detail panel
2. Click **Play** — the emulator opens full-screen in the current tab
3. Press **Menu** (top-left) to access in-game options
4. Click **← Back** or press Escape to return to the library (auto-save triggers on exit)

### In-game menu

| Panel | What it does |
|---|---|
| Save Manager | Save and load up to 4 named slots with thumbnail previews |
| Cheats | Add, toggle, and delete cheat codes for the current game |
| Display | Aspect ratio (4:3 / 16:9 / Pixel / Fill) and shader filter (None / CRT / Smooth / Scanlines / LCD / Phosphor) |
| Remap Keys | Reassign any button for the current game; save named remap profiles |
| Controls | Quick-reference for default keyboard layout |
| Sleep Timer | Auto-quit after a set number of minutes |
| Test Pad | Live gamepad button tester |

### Controls

| Action | Default |
|---|---|
| Menu toggle | `Escape` or on-screen button |
| Rewind | Hold `R` (configurable) |
| Fast-forward | Hold `F` (3× speed, configurable) |
| Screenshot | Screenshot button in menu |

Connect a USB or Bluetooth gamepad before launching — it's detected automatically.

---

## Player profiles

Profiles let multiple people (or playthroughs) share the same HomeArcade install without their saves, cheats, or button remaps colliding.

**To create a profile:**
1. Go to **Settings → Player profiles**
2. Enter a name, pick a colour, click **Add**

**To switch profiles:**
- Click the profile button in the top-right of the library header
- Select the profile from the dropdown — it's remembered across sessions

Each profile has its own save states, cheat codes, and key remap presets. The default **Player 1** profile cannot be deleted.

---

## Cheat codes

1. Launch a game and open the **Menu**
2. Click **Cheats** — the Cheats panel slides in
3. Enter a description (e.g. "Infinite lives") and the cheat code (e.g. `7E0DBF63`)
4. Click **+ Add** — the cheat is saved to the server and listed below
5. Use the toggle switch to enable or disable individual cheats without deleting them

Cheats are scoped to the current game and active profile, so different profiles can have different cheat sets for the same game.

---

## Display shaders

Open **Menu → Display** while in-game to choose a visual filter:

| Filter | Effect |
|---|---|
| None | Clean, unfiltered output |
| CRT | Contrast + saturation boost to mimic a CRT |
| Smooth | Mild blur for softer pixel edges |
| Scanlines | Horizontal scanline overlay with pixelated rendering |
| LCD | High-contrast, desaturated pixel-perfect look (Game Boy style) |
| Phosphor | Green monochrome phosphor glow (classic green-screen feel) |

Your last-used aspect ratio and filter are remembered in the browser.

---

## Home Assistant integration

### Events

HomeArcade fires HA events you can use in automations:

```yaml
trigger:
  - platform: event
    event_type: homearcade_game_started  # or homearcade_game_ended
```

Event data includes `rom_id`, `title`, and `system`.

### Now Playing sensor

Add an `input_text` helper to track what's currently playing:

```yaml
# configuration.yaml
input_text:
  homearcade_now_playing:
    name: HomeArcade Now Playing
    initial: ""
```

### Lovelace card

1. Download `homearcade-card.js` from **Settings → Lovelace card → Download**
2. Copy it to `/config/www/homearcade-card.js` in your HA config
3. Add a resource in **Settings → Dashboards → ⋮ → Resources**:
   ```
   /local/homearcade-card.js   (JavaScript module)
   ```
4. Add a card to any dashboard:
   ```yaml
   type: custom:homearcade-card
   base_url: http://homeassistant.local:8123
   title: Now Playing
   max_recent: 6
   ```

---

## RetroAchievements

1. Create a free account at [retroachievements.org](https://retroachievements.org)
2. Go to **Settings → RetroAchievements** in HomeArcade
3. Enter your username and API key (RA profile → Settings → Keys)
4. Save — achievements unlock automatically during gameplay

View your stats and recent unlocks on the **Achievements** page (trophy icon in the sidebar).

---

## Metadata / cover art (ScreenScraper)

1. Register free at [screenscraper.fr](https://www.screenscraper.fr)
2. Go to **Settings → ScreenScraper** and enter your username + password
3. Open any game's detail card and click **Find art** — cover art, description, and genre are fetched automatically

Art is also scraped automatically on upload if credentials are configured.

---

## Kiosk mode

Enable in **Settings → Kiosk**. Hides settings and system management pages, and optionally requires a PIN to exit. Pin a specific Collection to restrict the library to a curated game list — useful for kids' setups or TV installs.

---

## Troubleshooting

### Game loads to 0% and stalls
- Hard-refresh the page (`Ctrl`+`Shift`+`R`) to clear cached JS
- Check the add-on log (**Settings → Apps → HomeArcade → Log**) for errors
- Make sure you're on the latest version (click **Update** if available)

### "Couldn't launch game" error
- The ROM file may have been deleted from `/data/rom-storage/`. Re-upload the ROM.
- The add-on may have restarted — wait a moment and try again.

### Upload returns 404 under HA Ingress
- Make sure the add-on status is **Started** (not just installed)
- Hard-refresh the panel — the Ingress token rotates on restart
- Check **Settings → Apps → HomeArcade → Log** for startup errors

### Cover art scrape returns "No art found"
- Rename the ROM file to exactly match the official title (e.g. `Super Mario World (USA).sfc`)
- Check your ScreenScraper credentials in Settings
- ScreenScraper has daily rate limits on free accounts — try again after midnight UTC

### Add-on won't start after install
- Check the Log tab for build errors
- If you see `better-sqlite3` errors, try **Rebuild** (re-compiles the native module for your architecture)
- On Raspberry Pi 4 (aarch64), the first build can take up to 10 minutes — be patient

### Changes I pushed to GitHub aren't showing up
- "Rebuild" uses HA's cached source copy — it does **not** re-fetch from GitHub
- To pull new code, wait for a version bump and click **Update** instead

### The sidebar shows "Cabinet" instead of "HomeArcade"
- Cosmetic only from an older install. Remove and re-add the add-on to get the correct title, or rename the entry in your HA dashboard settings.

### Gamepad not detected
- Plug in the controller **before** launching the emulator
- Open Menu → Test Pad — if buttons show up there, it's working
- Some browsers require a button press to "activate" a newly connected gamepad

### Profile saves aren't separated
- Make sure you've selected the correct profile from the library header **before** launching the game
- The active profile ID is passed as `?profile=` to the player — check the URL bar to confirm it's set

---

## Local development

```bash
cd cabinet_bridge
npm install
CABINET_DATA_DIR=/tmp/ha-arcade-dev npm run dev
```

The dev server starts at `http://localhost:5000`. Set `CABINET_DATA_DIR` to any writable directory.

```bash
npm test            # run Vitest integration suite
npm run test:watch  # watch mode
npm run build       # production build (same as Docker)
```

---

## Repository layout

```
.
├── README.md
├── repository.yaml          # HA add-on repository manifest
└── cabinet_bridge/          # the add-on (Docker build context)
    ├── config.yaml          # add-on manifest — bump version to ship updates
    ├── Dockerfile
    ├── run.sh
    ├── client/              # React + Vite SPA
    │   ├── src/pages/       # Home, Settings, Achievements, …
    │   ├── src/components/  # UI components
    │   └── homearcade-card.js  # standalone Lovelace card
    ├── server/
    │   ├── routes.ts        # all API endpoints + emulator bootstrap JS
    │   └── storage.ts       # SQLite / Drizzle ORM
    └── shared/              # shared Zod + Drizzle schema
```

---

## Changelog

### v0.7.38
- Bump version to trigger Home Assistant update

### v0.7.37
- **Netplay lobby UI** — Create or join rooms via the library header; view active rooms and join with a code

### v0.7.36
- **ROM scanner** — Auto-import ROMs from a watched folder on the host

### v0.7.35
- **Smart filter collections** — Dynamic game lists based on rules (system, genre, etc.)

### v0.7.34
- **Appearance settings** — New theme picker in Settings

### v0.7.33
- **Play status & Live timer** — Status badges on cards and real-time playtime updates

### v0.6.0
- **TheGamesDB scraper** — new primary metadata source (box art, descriptions, genre, developer, publisher); add your free API key in Settings → Services. Falls through to ScreenScraper then Libretro thumbnails if unmatched
- **Play History page** — dedicated `/history` route showing all sessions grouped by day with per-game playtime bars, total playtime stat, and most-played game summary
- **Per-profile favorites, ratings, and play status** — non-default profiles maintain their own favorites, star ratings, and backlog/playing/completed status independently of the global library
- **Per-profile key bindings** — Settings → Controls now has a profile selector; each profile stores its own keyboard overrides on top of global defaults, loaded at game launch
- **Mobile landscape mode** — on-screen pad compresses correctly in landscape orientation; button press feedback animation on touch devices
- **Touch responsiveness** — `touch-action: manipulation` on game cards eliminates the 300 ms tap delay on iOS/Android; scroll containers use `overscroll-contain` for native feel

### v0.5.3
- ROM upload progress bar with per-file and overall percentage using `XMLHttpRequest`

### v0.5.2 (hotfix)
- Fixed `Unexpected token 'var'` crash caused by regex backslash consumption inside TypeScript template literals; replaced with `indexOf`/`slice` URL derivation

### v0.5.1
- Fixed netplay relay URL derivation behind HA Ingress prefix

### v0.5.0
- **Named player profiles** — create profiles in Settings → Player Profiles; switch from the library header; save states, cheats, and key remaps are isolated per profile
- **Cheat codes panel** — full slide-in panel to add, toggle, and delete cheat codes per game per profile
- **Three new shader presets** — Scanlines, LCD (pixel-perfect), Phosphor (green glow)
- **Netplay** — WebSocket relay server; create or join a room code to play with a friend

### v0.4.12
- **Named player profiles** — create profiles in Settings → Player profiles; switch from the library header; save states, cheats, and key remaps are isolated per profile
- **Cheat codes panel** — full slide-in panel to add, toggle, and delete cheat codes per game per profile (replaces non-functional stub)
- **Three new shader presets** — Scanlines (scanline overlay), LCD (pixel-perfect high-contrast), Phosphor (green monochrome glow)

### v0.4.12
- Display settings (aspect ratio and filters) now reliably override EmulatorJS canvas styles via CSS `!important`

### v0.4.11
- Systems sidebar sorted by console release date

### v0.4.10 – v0.4.8
- Fixed Express 5 wildcard route crash
- Fixed games stuck at 0% (Content-Length / gzip mismatch)
- Fixed template literal syntax error in bootstrap JS

---

## Links

- [Report a bug](https://github.com/GlerschNersch/token/issues/new)
- [EmulatorJS](https://emulatorjs.org)
- [RetroAchievements](https://retroachievements.org)
- [ScreenScraper](https://www.screenscraper.fr)

## Support

If HomeArcade has been useful to you, a small tip is always appreciated but never expected!

[![Venmo](https://img.shields.io/badge/Venmo-@vincusmalincus-3D95CE?style=for-the-badge&logo=venmo&logoColor=white)](https://venmo.com/vincusmalincus)
