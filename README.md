# HomeArcade

> The premium retro gaming frontend for Home Assistant.

HomeArcade is a powerful Home Assistant Add-on that turns your sidebar into a full retro gaming hub. Manage ROMs, browse systems with rich metadata, launch games in a high-performance in-browser emulator, and sync with your local PC via RetroBat integration.

**Current version: 2.16.0** · [Report a bug](https://github.com/GlerschNersch/token/issues/new) · [View source](https://github.com/GlerschNersch/token)

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

## Changelog

### v2.16.0
- **tltlvilus Theme** — Added a modern minimalist dashboard layout with high-impact system silhouettes and master-detail navigation.
- **Responsive Mobile Integration** — Optimized tltlvilus theme for mobile with a drawer-style metadata panel and touch-friendly list.

### v2.15.0
- **Final Theme Fine-Tuning** — Refined all dashboard layouts (Nostalgia Grid, PlayHub, Colorful, Alekfull, Art Book) for pixel-perfect mobile and browser display.
- **Improved Drawer Interactions** — Enhanced mobile details drawers with spring physics and touch-friendly close targets.
- **Dynamic Portfolios** — Art Book Next now features improved hero layouts for both system and game views.

### v2.14.0
- **Libretro Deep Integration** — Professional-grade automation features powered by the Libretro database.
- **CRC Deep Scan** — Perfect ROM identification using binary fingerprints (CRC32). Identifies games regardless of filename.
- **Gamepad Autoconfig** — Plug-and-play controller support. Automatically fetch verified button mappings for hundreds of controllers.
- **Improved Scraper Pipeline** — Scanner now calculates file hashes during import for instant metadata readiness.

### v2.13.0
- **Global Theme Optimization** — Massive pass across all themes (Nostalgia, PlayHub, Colorful, Alekfull, Art Book) to ensure 100% mobile responsiveness.
- **Mobile Details Drawers** — Added sleek, drawer-style info panels for small screens, replacing static sidebars.
- **Performance Tuning** — Optimized backdrop blurs and animation frame rates for smoother browser rendering.
- **Touch Mastery** — Re-engineered touch targets and gesture handling for handheld devices.

### v2.12.1
- **Theme Cleanup** — Removed Slate and gameOS themes to focus on fully mobile-optimized layouts.
- **Mobile Refinement** — Improved responsiveness across all remaining dashboard styles.

### v2.12.0
- **Theme Expansion** — Added Alekfull NX (Switch Style) and Art Book Next (Magazine) themes.
- **Enhanced OS Simulation** — Added real-time status bar to Alekfull theme.

### v2.11.0
- **Colorful Theme** — Added a high-vibrancy, bold dashboard layout inspired by Anthony Caccese's "Colorful" series.
- **Giant Tile Navigation** — Massive vertical box art and system-matched background gradients.

### v2.10.2
- **PlayHub Visibility Fix** — Corrected a bug that hid the game info panel on desktop screens.
- **Dynamic Fanart Backgrounds** — PlayHub now features full-screen, cross-fading game art as you browse the grid.
- **Improved Art Scaling** — Re-engineered box art fitting to prevent squashed images in PlayHub.

### v2.10.1
- **Theme Cleanup** — Removed the Horizon Ribbon theme to streamline the experience.
- **Slate Theme Integration** — Fully operational Slate theme for power users.

### v2.10.0
- **Slate Theme** — Added a new professional, high-density layout inspired by EmulationStation Desktop Edition.
- **Improved List Navigation** — Smooth vertical scrolling and metadata panels for power users.

### v2.3.4
- **Rebranding** — Finalized transition from "Cabinet Bridge" to **HomeArcade** across all UI and documentation.
- **Global Localization** — Updated all translation files to reflect the new HomeArcade branding.
- **Premium Frontend Engine** — Rebuilt from the ground up with Vite + React + Tailwind v4.
- **Dashboard** — New central landing page with recently played, stats, and activity feed.
- **Advanced Integration** — Direct integration with RetroBat and Home Assistant webhooks for PC control.
- **Smart Filters** — Create dynamic collections using complex rules (genre, rating, year, etc.).
- **Netplay Lobby** — Built-in lobby for multiplayer sessions.
- **Enhanced Performance** — Optimized server bundle and client assets for faster load times.

---

## Links

- [Report a bug](https://github.com/GlerschNersch/token/issues/new)
- [EmulatorJS](https://emulatorjs.org)
- [RetroAchievements](https://retroachievements.org)
- [ScreenScraper](https://www.screenscraper.fr)

## Support

If HomeArcade has been useful to you, a small tip is always appreciated but never expected!

[![Venmo](https://img.shields.io/badge/Venmo-@vincusmalincus-3D95CE?style=for-the-badge&logo=venmo&logoColor=white)](https://venmo.com/vincusmalincus)
