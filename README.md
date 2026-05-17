# HomeArcade

> The premium retro gaming frontend for Home Assistant.

HomeArcade is a powerful Home Assistant Add-on that turns your sidebar into a full retro gaming hub. Manage ROMs, browse systems with rich metadata, launch games in a high-performance in-browser emulator, and sync with your local PC via RetroBat integration.

**Current version: 2.22.13** · [Report a bug](https://github.com/GlerschNersch/token/issues/new) · [View source](https://github.com/GlerschNersch/token)

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
| Game Boy | gambatte | `.gb" ".zip` |
| Atari Lynx | mednafen_lynx | `.lnx` `.zip` |
| Game Gear | smsgg | `.gg" ".zip` |
| Neo Geo | fbneo | `.zip` |
| SNES | snes9x | `.smc" ".sfc" ".zip` |
| Sega CD | segaCD | `.cue+.bin" ".iso" ".chd" ".zip` |
| Sega 32X | picodrive | `.32x" ".bin" ".zip` |
| Saturn | yabause | `.iso" ".bin" ".zip` |
| PlayStation 1 | pcsx | `.cue+.bin" ".iso" ".pbp" ".chd" ".zip` |
| Virtual Boy | beetle_vb | `.vb" ".zip` |
| Nintendo 64 | mupen64plus | `.n64" ".z64" ".v64" ".zip` |
| Game Boy Color | gambatte | `.gbc" ".zip` |
| Dreamcast | reicast | `.cdi" ".gdi" ".chd" ".zip` |
| PlayStation 2 | pcsx2 | `.iso" ".bin" ".zip` |
| Game Boy Advance | mgba | `.gba" ".zip` |
| Nintendo DS | melonds | `.nds" ".zip` |
| PSP | ppsspp | `.iso" ".cso" ".pbp" ".zip` |

---

## Changelog

### v2.22.13
- **Feature: Resume from Last Save:** You can now resume your games directly from the dashboard. If a save state exists, a new "Resume" button will appear in the game detail panel, automatically loading your latest progress.
- **Visual Feedback:** Added a "Latest Save" status card to the game overview, providing quick info on your most recent save slot.
- **Player Sync:** Enhanced the emulator bootstrap to support direct slot loading via dashboard shortcuts.

### v2.22.12
- **Scraper Enhancement:** Improved TheGamesDB matching logic with fuzzy title fallbacks. Descriptions and release dates are now much more likely to populate for existing games.
- **Data Integrity:** Refined metadata update logic to ensure all fields are correctly cleared or updated in the database during scraper fallbacks.
- **Improved Monitoring:** Added server-side logs to track scraper performance and matching success rates.

### v2.22.11
- **Enhanced Mobile Navigation:** Redesigned the system selector bar to include a pinned "Quick Actions" overlay. The Library and Settings icons are now consistently visible and easier to tap, featuring improved contrast and a subtle background gradient to prevent content overlap.

### v2.22.10
- **Fix:** Resolved a `ReferenceError: LayoutGrid is not defined` crashing the mobile dashboard.

### v2.22.9
- **Fix:** Resolved a bug in the BIOS upload logic where incorrect data handling caused uploads to fail with a "toLowerCase" error.

### v2.22.8
- **Mobile UX Improvement:** Added a "Library" icon next to the Settings icon for quicker navigation on mobile devices.

### v2.22.7
- **Mobile Access Fix:** Added a persistent settings icon to the system selector bar, ensuring mobile and tablet users can access the settings panel even when the desktop header is hidden.

### v2.22.6
- **Fix:** Corrected API routing issues for Home Assistant Ingress. Widespread "Not Found" errors in Settings and Game Details are now resolved by correctly resolving the relative base path.
- **Improved Scraping:** Fixed a bug that caused "Bulk Scrape" to fail when accessed via the Home Assistant sidebar.

### v2.22.5
- **Fix:** Resolved "bootstrap.js blocked" error on systems requiring a BIOS (PS1, PS2, SegaCD, GBA, etc.).
- **Improved Error Reporting:** Bootstrap script now returns descriptive error messages (e.g., missing BIOS filenames) instead of generic browser blocking errors.

### v2.22.4
- **Layout Optimization** — Reduced redundant headers and improved vertical spacing on mobile devices for a more compact UI.

### v2.22.3
- **Visual Polish** — Hidden unwanted browser scrollbars for a cleaner "app-like" experience.

### v2.22.2
- **UI Refinement** — Removed the bottom bar and controller hints for a cleaner interface.
- **Action Update** — Changed primary action button text to "Play Game".

### v2.22.1
- **Official Rebranding** — Fully transitioned from PlayHub to **HomeArcade**.
- **UX Fix** — Corrected game collection management (fixed `handleToggleCollection` reference).
- **System Stability** — Renamed internal theme components for long-term maintainability.

---

## Links

- [Report a bug](https://github.com/GlerschNersch/token/issues/new)
- [EmulatorJS](https://emulatorjs.org)
- [RetroAchievements](https://retroachievements.org)
- [ScreenScraper](https://www.screenscraper.fr)

## Support

If HomeArcade has been useful to you, a small tip is always appreciated but never expected!

[![Venmo](https://img.shields.io/badge/Venmo-@vincusmalincus-3D95CE?style=for-the-badge&logo=venmo&logoColor=white)](https://venmo.com/vincusmalincus)
