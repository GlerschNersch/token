# HomeArcade

> The premium retro gaming frontend for Home Assistant.

HomeArcade is a powerful Home Assistant Add-on that turns your sidebar into a full retro gaming hub. Manage ROMs, browse systems with rich metadata, launch games in a high-performance in-browser emulator, and sync with your local PC via RetroBat integration.

**Current version: 2.17.1** · [Report a bug](https://github.com/GlerschNersch/token/issues/new) · [View source](https://github.com/GlerschNersch/token)

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

### v2.17.1
- **Database Migration Fix** — Added missing `crc32` column to the `uploaded_roms` table to fix ROM upload and scanning errors.

### v2.17.0
- **PlayHub Refocus** — Reset the dashboard system to focus exclusively on a clean, high-performance re-implementation of the PlayHub theme.
- **Improved Glassmorphism** — Added deep backdrop blurs and refined gradients for a premium "Switch-like" feel.
- **Dynamic Backgrounds** — High-blur fanart backgrounds that transition smoothly as you browse.

### v2.16.1
- **Fix:** Resolved a crash in the tltlvilus theme when navigating systems with empty libraries.

### v2.16.0
- **tltlvilus Theme** — Added a modern minimalist dashboard layout with high-impact system silhouettes and master-detail navigation.

### v2.15.0
- **Final Theme Fine-Tuning** — Refined all dashboard layouts for pixel-perfect mobile and browser display.

### v2.14.0
- **Libretro Deep Integration** — Professional-grade automation features powered by the Libretro database.
- **CRC Deep Scan** — Perfect ROM identification using binary fingerprints (CRC32).
- **Gamepad Autoconfig** — Plug-and-play controller support.

### v2.13.0
- **Global Theme Optimization** — Massive pass across all themes to ensure 100% mobile responsiveness.

---

## Links

- [Report a bug](https://github.com/GlerschNersch/token/issues/new)
- [EmulatorJS](https://emulatorjs.org)
- [RetroAchievements](https://retroachievements.org)
- [ScreenScraper](https://www.screenscraper.fr)

## Support

If HomeArcade has been useful to you, a small tip is always appreciated but never expected!

[![Venmo](https://img.shields.io/badge/Venmo-@vincusmalincus-3D95CE?style=for-the-badge&logo=venmo&logoColor=white)](https://venmo.com/vincusmalincus)
