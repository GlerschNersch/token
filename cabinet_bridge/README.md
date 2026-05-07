# Cabinet Bridge — Home Assistant Add-on

Retro gaming frontend that runs inside Home Assistant. ROM uploads, save-state metadata, and the system-image cache live under `/data` so they persist across add-on restarts.

## Install

1. Add this repository to Home Assistant: **Settings → Add-ons → Add-on Store → ⋮ → Repositories**, then paste the URL of this repo.
2. Find **Cabinet Bridge** in the add-on store and click **Install**.
3. Click **Start**. The add-on listens on port 5000 internally and is exposed via Home Assistant Ingress (sidebar entry: "Cabinet").

No options to configure. The add-on stores its SQLite database, uploaded ROMs, and cached system art under `/data` inside the container, which Home Assistant persists for you.

## Local development (without Home Assistant)

Set `CABINET_DATA_DIR` to override the data directory:

```bash
CABINET_DATA_DIR=/tmp/cabinet-data npm run dev
```

When `CABINET_DATA_DIR` is unset and `/data` is not writable, the project falls back to the current working directory (the original behavior).
