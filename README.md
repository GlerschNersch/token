# HomeArcade

> Retro gaming, right inside Home Assistant.

HomeArcade is a Home Assistant Add-on that turns your sidebar into a full retro game library. Upload ROMs, browse by system, launch games in an in-browser emulator, track play time, and earn RetroAchievements — all without leaving Home Assistant.

**Current version: 0.4.1** · [Report a bug](https://github.com/GlerschNersch/token/issues/new) · [View source](https://github.com/GlerschNersch/token)

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

| System | Core | Accepted formats |
|---|---|---|
| NES | nestopia | `.nes` `.zip` |
| SNES | snes9x | `.smc` `.sfc` `.zip` |
| Nintendo 64 | mupen64plus | `.n64` `.z64` `.v64` `.zip` |
| Game Boy | gambatte | `.gb` `.zip` |
| Game Boy Color | gambatte | `.gbc` `.zip` |
| Game Boy Advance SP | mgba | `.gba` `.zip` |
| Nintendo DS | melonds | `.nds` `.zip` |
| Genesis / Mega Drive | segaMD | `.md` `.bin` `.smd` `.zip` |
| PlayStation 1 | pcsx | `.cue+.bin` `.iso` `.zip` |
| PlayStation 2 | pcsx2 | `.iso` `.bin` `.zip` |
| PSP | ppsspp | `.iso` `.cso` `.pbp` `.zip` |
| Dreamcast | reicast | `.cdi` `.gdi` `.chd` `.zip` |
| Arcade (MAME) | mame2003 | `.zip` |

---

## Features

- **In-browser emulator** — powered by [EmulatorJS](https://emulatorjs.org); no plugins or installs needed
- **Save states** — up to 4 slots per game with thumbnail previews; server-side cloud backup/restore
- **Metadata scraping** — cover art, descriptions, genres from [ScreenScraper.fr](https://www.screenscraper.fr) (free account)
- **RetroAchievements** — live achievement unlocks and a dashboard with your stats
- **Play time tracking** — minutes played per game, recently played shelf
- **Kiosk mode** — lock the UI with an optional PIN for shared/TV setups
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

- Home Assistant OS or Supervised (app support required)
- `amd64` or `aarch64` host architecture
- ~500 MB free space for the Docker image; more for ROMs

### Step-by-step

1. **Settings → Apps → Add-on Store → ⋮ (three dots, top right) → Repositories**
2. Paste `https://github.com/GlerschNersch/token` and click **Add**
3. Close the dialog and scroll to find **HomeArcade** in the store
4. Click **Install** — the first build takes 2–5 minutes (compiling native SQLite bindings)
5. Once installed, click **Start**
6. Toggle **Show in sidebar** on the App page
7. Click **Open Web UI** or select HomeArcade from the sidebar

> The app runs on port 5000 internally and is exposed via HA Ingress — no firewall rules or reverse-proxy configuration needed.

### Updating

When a new version is available, an **Update** button appears at the top of the HomeArcade add-on page. Click it — your ROMs, save states, and settings are preserved (they live in the Supervisor-managed `/data` volume, which is never touched by an update).

> **Rebuild vs Update:** "Rebuild" re-compiles the currently installed version from HA's local cache. "Update" pulls the latest code from GitHub and rebuilds — use this to get new features and bug fixes.

---

## Uploading ROMs

ROMs are stored in `/data/rom-storage/` inside the app and tracked in a SQLite database — both survive updates and restarts.

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
3. Press **Menu** (top-left) to access save states, rewind, fast-forward, shaders, key remapping, and the sleep timer
4. Click **← Back** or press Escape to return to the library (auto-save triggers on exit)

### Controls

| Action | Default |
|---|---|
| Menu toggle | `Escape` or on-screen button |
| Save state | Save Manager panel → slot → Save |
| Load state | Save Manager panel → slot → Load |
| Rewind | Hold `R` (configurable) |
| Fast-forward | Hold `F` (configurable) |
| Screenshot | Screenshot button in menu |

Connect a USB or Bluetooth gamepad before launching — it's detected automatically. Use **Test Pad** in the emulator menu to verify button mapping.

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

Enable in **Settings → Kiosk**. Hides settings/system management pages and optionally requires a PIN to exit. Pin a specific Collection to restrict the library to a curated game list — useful for kids' profiles or TV setups.

---

## Troubleshooting

### Game loads to 0% and stalls
- Hard-refresh the page (`Ctrl`+`Shift`+`R`) to clear cached JS
- Check the app log (**Settings → apps → HomeArcade → Log**) for errors
- Make sure you're on the latest version (click **Update** if available)

### "Couldn't launch game" error
- The ROM file may have been deleted from `/data/rom-storage/`. Re-upload the ROM.
- The app may have restarted — wait a moment and try again.

### Upload returns 404 under HA Ingress
- Make sure the app status is **Started** (not just installed)
- Hard-refresh the panel — the Ingress token rotates on restart
- Check **Settings → app → HomeArcade → Log** for startup errors

### Cover art scrape returns "No art found"
- Rename the ROM file to exactly match the official title (e.g. `Super Mario World (USA).sfc`)
- Check your ScreenScraper credentials in Settings
- ScreenScraper has daily rate limits on free accounts — try again after midnight UTC

### Apps won't start after install
- Check the Log tab for build errors
- If you see `better-sqlite3` errors, try **Rebuild** (this re-compiles the native module for your architecture)
- On Raspberry Pi 4 (aarch64), the first build takes up to 10 minutes — be patient

### Changes I pushed to GitHub aren't showing up
- "Rebuild" uses HA's cached source copy — it does **not** re-fetch from GitHub
- To pull new code, wait for a version bump and click **Update** instead

### The sidebar shows "Cabinet" instead of "HomeArcade"
- This is a leftover panel title from older installs — it's cosmetic only. Remove and re-add the app to get the correct title, or rename it in your HA dashboard settings.

### Gamepad not detected
- Plug in the controller **before** launching the emulator
- Open Menu → Test Pad — if buttons show up there, it's working
- Some browsers require a button press to "activate" a newly connected gamepad

---

## Local development

```bash
cd cabinet_bridge
npm install
CABINET_DATA_DIR=/tmp/ha-arcade-dev npm run dev
```

The dev server starts at `http://localhost:5000`. Set `CABINET_DATA_DIR` to any writable directory.

```bash
npm test          # run Vitest integration suite
npm run test:watch  # watch mode
npm run build     # production build (same as Docker)
```

---

## Repository layout

```
.
├── README.md
├── repository.yaml          # HA app repository manifest
└── cabinet_bridge/          # the app (Docker build context)
    ├── config.yaml          # app manifest — bump version to ship updates
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

## Links

- [Report a bug](https://github.com/GlerschNersch/token/issues/new)
- [EmulatorJS](https://emulatorjs.org)
- [RetroAchievements](https://retroachievements.org)
- [ScreenScraper](https://www.screenscraper.fr)

## Support

If HomeArcade has been useful to you, a small tip is always appreciated but never expected!

[![Venmo](https://img.shields.io/badge/Venmo-@vincusmalincus-3D95CE?style=for-the-badge&logo=venmo&logoColor=white)](https://venmo.com/vincusmalincus)
