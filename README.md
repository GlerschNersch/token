# HomeArcade

> The premium retro gaming frontend for Home Assistant.

HomeArcade is a powerful Home Assistant Add-on that turns your sidebar into a full retro gaming hub. Manage ROMs, browse systems with rich metadata, launch games in a high-performance in-browser emulator, and sync with your local PC via RetroBat integration.

**Current version: 2.22.6** · [Report a bug](https://github.com/GlerschNersch/token/issues/new) · [View source](https://github.com/GlerschNersch/token)

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

### v2.21.0
- **Mobile Overlap Fix** — Added safe area padding to all panels and buttons to ensure they clear mobile navigation bars.
- **Space Optimization** — Automatically hide duplicate system headers on mobile to reclaim screen real estate.
- **Improved Tab Visibility** — Increased contrast and brightness of unselected tabs in the management hub.
- **Translation Fix** — Corrected the 'Library' label in the mobile navigation bar.

### v2.20.0
- **Intuitive Tab Naming** — Renamed HomeArcade tabs to Overview, Cheats, Saves, and Manage for better clarity.
- **Mobile Tab Optimization** — The side panel tab bar is now scrollable on mobile to ensure all management buttons are visible.
- **UX Refinement** — Cleaned up descriptions and mission status labels for a more professional feel.

### v2.19.2
- **Fix:** Resolved `ReferenceError: Info is not defined` crashing the HomeArcade dashboard.
- **Improved Management Hub:** Refined the integrated game management panel for better stability.

### v2.19.1
- **Fix:** Resolved `ReferenceError: useCallback is not defined`.

### v2.19.0
- **Unified HomeArcade Hub** — Major architectural shift merging game management (saves, cheats, achievements, collections) directly into the HomeArcade side panel.
- **Zero-Popup UX** — Eliminated the standard detail dialog in favor of a seamless, integrated 'Command Center' within the dashboard.

---

## Links

- [Report a bug](https://github.com/GlerschNersch/token/issues/new)
- [EmulatorJS](https://emulatorjs.org)
- [RetroAchievements](https://retroachievements.org)
- [ScreenScraper](https://www.screenscraper.fr)

## Support

If HomeArcade has been useful to you, a small tip is always appreciated but never expected!

[![Venmo](https://img.shields.io/badge/Venmo-@vincusmalincus-3D95CE?style=for-the-badge&logo=venmo&logoColor=white)](https://venmo.com/vincusmalincus)
