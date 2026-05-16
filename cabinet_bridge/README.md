# Cabinet Bridge — Home Assistant Add-on

Retro gaming frontend that runs inside Home Assistant. ROM uploads, integration
settings, save-state metadata, and the system-image cache live under `/data` so
they persist across add-on restarts and updates.

Source and full documentation: <https://github.com/GlerschNersch/token>

## Install

1. **Settings → Add-ons → Add-on Store → ⋮ → Repositories** and add:

   ```
   https://github.com/GlerschNersch/token
   ```

2. Find **Cabinet Bridge** in the store and click **Install** (the first build
   may take several minutes).
3. Click **Start**. The add-on listens on port 5000 internally and is exposed
   via Home Assistant Ingress (sidebar entry: **HomeArcade**, or use **Open Web
   UI** from the add-on page).

Connection settings (HA base URL, long-lived token, endpoint overrides, Live
mode) are managed from inside the panel at **Settings**, and persist to the
add-on's SQLite database.

### Add-on options

| Option | Default | What it does |
| --- | --- | --- |
| `max_upload_mb` | `8192` | Per-file ROM upload ceiling. Raise for very large PS2 disc images, lower to fence off the add-on from oversized uploads. |

The add-on also enables `ingress_stream: true` so Home Assistant streams large
upload bodies through the Supervisor proxy instead of capping them at the
default 16 MB ingress limit.

## Updating

Home Assistant only surfaces an **Update** button when the add-on `version`
changes. To check for and apply updates:

1. **Settings → Add-ons → ⋮ → Check for updates**.
2. Open **Cabinet Bridge** and click **Update** if it appears.
3. If you expect an update but don't see one, use **⋮ → Rebuild** to force a
   fresh build, then hard-refresh the panel (Ctrl/Cmd-Shift-R) to drop cached
   JS/CSS.

> Maintainers: bump `version:` in `config.yaml` for every shipped change.
> Home Assistant will not detect a new build without a version change.

## Persistent data

| Path | What it stores |
| --- | --- |
| `/data/data.db` | SQLite — integration settings and ROM metadata |
| `/data/rom-storage/` | Uploaded ROM files, organized by system slug |
| `/data/system-image-cache/` | Downloaded console artwork |

If `/data` is not writable (e.g. when running outside Home Assistant) the
backend honors `CABINET_DATA_DIR`, otherwise falls back to the current working
directory.

## ROM uploads

Uploads happen from the **system page** for the console you're adding to. Open
**NES**, **SNES**, **PS1**, etc. from the sidebar and an "Upload ROMs" dropzone
appears at the top — labelled with the active system (e.g. "Upload PS1 ROMs"),
so files dropped there are filed under the right console without you having to
pick one. The grid below refreshes immediately with the new game and the
sidebar count for that system goes up.

The All Games view also offers an upload dropzone, but there you must pick a
console first because the upload isn't bound to a specific system page.

**Settings** no longer hosts the upload dropzone — it links you to the system
pages and is otherwise focused on integration config and managing already-
uploaded ROMs (delete, refresh art).

The backend must run as the Home Assistant add-on for uploads to work. Uploads
write to `/data/rom-storage/` and `/data/data.db`, which only exist inside the
Supervisor-managed container. A standalone deploy of the SPA will load the UI
but every upload will 404.

If you see a 404 on upload under HA ingress: confirm the add-on is started,
hard-refresh the panel (the SPA detects the
`/api/hassio_ingress/<token>/` prefix only after the latest JS is loaded), and
update or rebuild the add-on if it is out of date.

The mobile picker uses an unfiltered file dialog; allowed extensions are
validated server-side per system after the file is chosen. Supported archive
formats include `.zip` and `.7z`; PS1 also accepts `.cue`/`.bin`/`.iso`/`.chd`/
`.pbp`. Multi-file selection is preserved, so PS1 `.cue`/`.bin` sets and
multi-disc archives upload as a batch.

Per-file uploads are capped at the value of the `max_upload_mb` add-on option
(default 8192 MB / 8 GB). The dropzone shows the active limit and refuses
oversize files before sending them.

## Local development (without Home Assistant)

The application source lives inside this `cabinet_bridge/` directory so Home
Assistant Supervisor can build the add-on with this folder as the Docker
context. Run npm commands from here:

```bash
cd cabinet_bridge
npm install
CABINET_DATA_DIR=/tmp/cabinet-data npm run dev
```

When `CABINET_DATA_DIR` is unset and `/data` is not writable, the project
falls back to the current working directory.
