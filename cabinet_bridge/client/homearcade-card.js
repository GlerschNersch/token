/**
 * homearcade-card — Lovelace custom element for HomeArcade
 *
 * Shows the currently-playing game (via /api/now-playing) and
 * a scrolling shelf of recently-played games (via /api/roms?sort=recent).
 *
 * Add to Lovelace:
 *   resources:
 *     - url: /local/homearcade-card.js
 *       type: module
 *
 *   cards:
 *     - type: custom:homearcade-card
 *       title: HomeArcade          # optional
 *       base_url: http://homeassistant.local:7860
 *       max_recent: 6              # optional, default 6
 */

const DEFAULT_BASE = "http://homeassistant.local:7860";
const POLL_MS = 12000;

const TPL = document.createElement("template");
TPL.innerHTML = `
<style>
  :host { display: block; }
  ha-card {
    padding: 16px;
    font-family: var(--primary-font-family, sans-serif);
    overflow: hidden;
  }
  .ha-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--secondary-text-color);
    margin: 0 0 12px;
  }
  /* Now-playing banner */
  .now-playing {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--primary-color, #ec4899);
    background: linear-gradient(135deg, var(--primary-color, #ec4899) 0%, #7c3aed 100%);
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 14px;
    color: #fff;
    min-height: 48px;
  }
  .now-playing.idle {
    background: var(--card-background-color, #1e1e2e);
    border: 1px solid var(--divider-color, rgba(255,255,255,0.08));
    color: var(--secondary-text-color);
  }
  .np-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 6px #4ade80;
    flex-shrink: 0;
    animation: blink 1.6s infinite;
  }
  .now-playing.idle .np-dot {
    background: var(--disabled-text-color, #666);
    box-shadow: none;
    animation: none;
  }
  @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
  .np-info { flex: 1; min-width: 0; }
  .np-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.75; }
  .np-title { font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .np-system { font-size: 11px; opacity: 0.75; }
  /* Recent shelf */
  .shelf-label {
    font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--secondary-text-color); margin-bottom: 8px;
  }
  .shelf {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 8px;
  }
  .game-chip {
    display: flex; flex-direction: column; align-items: center; gap: 5px;
    background: var(--card-background-color, rgba(255,255,255,0.04));
    border: 1px solid var(--divider-color, rgba(255,255,255,0.08));
    border-radius: 8px;
    padding: 8px 6px 7px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    text-decoration: none; color: inherit;
    overflow: hidden;
  }
  .game-chip:hover { border-color: var(--primary-color, #ec4899); background: var(--primary-color, #ec4899)1a; }
  .game-chip img {
    width: 56px; height: 56px; object-fit: cover; border-radius: 5px;
    background: var(--disabled-text-color, #444);
  }
  .game-chip .chip-title {
    font-size: 10px; font-weight: 600; text-align: center;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    width: 100%; color: var(--primary-text-color);
  }
  .game-chip .chip-sys {
    font-size: 9px; color: var(--secondary-text-color);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-align: center;
  }
  .empty { font-size: 12px; color: var(--secondary-text-color); padding: 8px 0; }
</style>
<ha-card>
  <div class="ha-title">HomeArcade</div>
  <div class="now-playing idle" id="np">
    <div class="np-dot"></div>
    <div class="np-info">
      <div class="np-label">Now Playing</div>
      <div class="np-title" id="np-title">Idle</div>
      <div class="np-system" id="np-system"></div>
    </div>
  </div>
  <div class="shelf-label">Recently Played</div>
  <div class="shelf" id="shelf"></div>
</ha-card>`;

class HomeArcadeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(TPL.content.cloneNode(true));
    this._config = {};
    this._pollTimer = null;
  }

  setConfig(config) {
    this._config = {
      title: config.title || "HomeArcade",
      base_url: (config.base_url || DEFAULT_BASE).replace(/\/$/, ""),
      max_recent: Number(config.max_recent) || 6,
    };
    this.shadowRoot.querySelector(".ha-title").textContent = this._config.title;
  }

  connectedCallback() {
    this._poll();
    this._pollTimer = setInterval(() => this._poll(), POLL_MS);
  }

  disconnectedCallback() {
    clearInterval(this._pollTimer);
  }

  async _poll() {
    const base = this._config.base_url;
    try {
      const [npRes, romsRes] = await Promise.all([
        fetch(`${base}/api/now-playing`),
        fetch(`${base}/api/roms?sort=recent&limit=${this._config.max_recent}`),
      ]);
      if (npRes.ok) this._renderNowPlaying(await npRes.json());
      if (romsRes.ok) this._renderShelf(await romsRes.json());
    } catch { /* network error — keep last state */ }
  }

  _renderNowPlaying(data) {
    const el = this.shadowRoot.getElementById("np");
    const title = this.shadowRoot.getElementById("np-title");
    const sys = this.shadowRoot.getElementById("np-system");
    if (data.playing) {
      el.classList.remove("idle");
      title.textContent = data.title || "Unknown";
      sys.textContent = data.system || "";
    } else {
      el.classList.add("idle");
      title.textContent = "Idle";
      sys.textContent = "";
    }
  }

  _renderShelf(roms) {
    const shelf = this.shadowRoot.getElementById("shelf");
    if (!roms || !roms.length) {
      shelf.innerHTML = '<div class="empty">No games played yet.</div>';
      return;
    }
    const base = this._config.base_url;
    const recent = roms.slice(0, this._config.max_recent);
    shelf.innerHTML = recent.map((rom) => {
      const img = rom.coverArt
        ? `${base}${rom.coverArt}`
        : `${base}/api/systems/${rom.system}/image`;
      return `<a class="game-chip" href="${base}/#/play/${rom.id}" target="_blank" rel="noopener">
        <img src="${img}" alt="" onerror="this.style.display='none'">
        <div class="chip-title" title="${rom.title}">${rom.title}</div>
        <div class="chip-sys">${rom.system.toUpperCase()}</div>
      </a>`;
    }).join("");
  }

  // HA card size hint
  getCardSize() { return 3; }
}

customElements.define("homearcade-card", HomeArcadeCard);
