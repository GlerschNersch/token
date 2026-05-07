# Cabinet Bridge

Retro gaming frontend for Home Assistant. Runs as a Home Assistant add-on so the
sidebar gains a **Cabinet** panel for browsing systems, launching games via HA
webhooks, and managing your own uploaded ROMs.

The add-on bundles both the React UI and the Express backend that handles ROM
uploads, settings persistence, and the system-image cache. All persistent state
lives under the supervisor-managed `/data` volume so it survives add-on
restarts and updates.

GitHub: <https://github.com/GlerschNersch/token>

## Install (Home Assistant add-on)

1. In Home Assistant: **Settings → Add-ons → Add-on Store → ⋮ (top right) →
   Repositories**.
2. Paste the repository URL and click **Add**:

   ```
   https://github.com/GlerschNersch/token
   ```

3. Close the dialog, scroll to the **Cabinet Bridge Add-ons** section in the
   store, and open **Cabinet Bridge**.
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

## Updating the add-on

Home Assistant only offers an **Update** button when the add-on's `version`
field changes, so updates are tied to the version in
[`cabinet_bridge/config.yaml`](cabinet_bridge/config.yaml).

To pull the latest build:

1. **Settings → Add-ons → ⋮ → Check for updates** (top-right of the add-on
   store).
2. Open **Cabinet Bridge**. If a newer version is available, an **Update**
   button appears at the top of the page — click it.
3. If you don't see an update button but expect one, also try:
   - **Settings → Add-ons → Cabinet Bridge → ⋮ → Rebuild** to force a fresh
     build of the current version.
   - Reload the page with a hard refresh (Ctrl/Cmd-Shift-R) so the browser
     drops cached JS/CSS from the previous version.

> **Maintainers:** any change that should ship to users must bump
> `version:` in `cabinet_bridge/config.yaml`. Home Assistant compares that
> string against the installed version, and will not surface an update prompt
> if it hasn't changed — even if you've pushed new commits.

## Persistent data

Everything Cabinet Bridge needs to remember lives under `/data` inside the
add-on container, which Home Assistant Supervisor persists across restarts,
updates, and rebuilds:

| Path | What it stores |
| --- | --- |
| `/data/data.db` | SQLite database: integration settings, ROM metadata, app state |
| `/data/rom-storage/` | Uploaded ROM files, organized by system slug |
| `/data/system-image-cache/` | Downloaded console artwork used by the Browse Systems tiles |

If the `/data` volume is not writable (for example when running outside Home
Assistant), the backend falls back to `CABINET_DATA_DIR` if set, otherwise to
the current working directory.

## Uploading ROMs

> **The backend must run as the Home Assistant add-on for uploads to
> succeed.** Uploads write to `/data/rom-storage/` and are recorded in
> `/data/data.db`; both paths are only writable inside the Supervisor-managed
> add-on container. Browsing a static deploy of the SPA (e.g. opening the
> built `dist/public/` from a CDN or another host) will load the UI but every
> upload will 404 because there is no backend handling `/api/roms/upload`.

Open the panel, pick a system, click **Manage ROMs**, then drag files in or
use **Browse ROM files**. Allowed extensions are enforced server-side per
system.

### Troubleshooting uploads

- **"404: Not Found" when uploading under HA ingress.** This was fixed in a
  recent build — the SPA now detects the
  `/api/hassio_ingress/<token>/` prefix and routes API calls through it. If
  you still see a 404:
  1. Make sure the add-on is actually **Started** (Settings → Add-ons →
     Cabinet Bridge → Start).
  2. Hard-refresh the panel (Ctrl/Cmd-Shift-R) so the browser loads the
     latest JS — old cached bundles still hit the wrong path.
  3. Check that you're on the latest add-on version (see *Updating the
     add-on* above). If not, **Update** or **Rebuild**.
  4. Confirm the upload is going to the add-on, not to Home Assistant
     itself: the network request URL should start with
     `/api/hassio_ingress/<token>/api/roms/upload`.
- **Upload picker won't show your file on Android/iOS.** Mobile browsers can
  filter the picker by MIME type and hide ROM files. The current UI uses an
  unfiltered picker plus a visible **Browse ROM files** button; allowed
  extensions are enforced after the file is chosen, so just pick the file
  and the validation will surface a clear error if it isn't supported.
- **Upload appears to succeed but the ROM doesn't show up.** Reload the
  manage-ROMs view; the list is fetched from `/data/data.db`, so a hard
  refresh after a successful upload guarantees a fresh read.

### Mobile notes

- The mobile UI exposes the same upload flow via the **Manage ROMs** sheet.
  Tap the dropzone or **Browse ROM files** to open the system file picker.
  Selected files are listed inline with a per-file remove control and a
  clear-all button.
- The on-screen virtual gamepad's d-pad and face buttons live in separate
  zones to avoid accidental simultaneous presses. If you customize the
  layout, keep that separation.

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

## Repository layout

```
.
├── README.md              # this file
├── repository.yaml        # Home Assistant add-on repository manifest
└── cabinet_bridge/        # the add-on itself (Docker context)
    ├── config.yaml        # add-on manifest — bump `version` to ship updates
    ├── Dockerfile
    ├── run.sh
    ├── README.md          # add-on-store description (shown inside HA)
    ├── client/            # React + Vite SPA
    ├── server/            # Express backend (uploads, settings, API)
    ├── shared/            # shared TypeScript schema
    └── ...
```

## Links

- Repository: <https://github.com/GlerschNersch/token>
- Issues: <https://github.com/GlerschNersch/token/issues>
