import { appSettings, collectionItems, gameCollections, hltbCache, romSaveSlots, uploadedRoms, users } from '@shared/schema';
import type {
  GameCollection,
  GameCollectionWithItems,
  HltbCache,
  InsertGameCollection,
  InsertRomSaveSlot,
  InsertUploadedRom,
  IntegrationSettings,
  RomSaveSlot,
  UploadedRom,
  User,
  InsertUser,
  SmartFilterRules,
} from '@shared/schema';
import { DEFAULT_INTEGRATION_SETTINGS, integrationSettingsSchema } from '@shared/schema';
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { and, desc, eq } from "drizzle-orm";
import { dataPath, ensureDir, getDataDir } from "./data-dir";

let _sqlite: Database.Database | null = null;
function getSqlite() {
  if (!_sqlite || (process.env.NODE_ENV === "test" && _sqlite.name !== dataPath("data.db"))) {
    ensureDir(getDataDir());
    const dbPath = dataPath("data.db");
    _sqlite = new Database(dbPath);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.exec(`
      CREATE TABLE IF NOT EXISTS uploaded_roms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        system TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        original_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        art_url TEXT,
        scrape_status TEXT NOT NULL DEFAULT 'not_scraped',
        scrape_message TEXT,
        favorite INTEGER NOT NULL DEFAULT 1,
        rating INTEGER NOT NULL DEFAULT 0,
        last_played INTEGER NOT NULL DEFAULT 0,
        play_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS game_collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS collection_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        rom_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(collection_id, rom_id)
      );
      CREATE TABLE IF NOT EXISTS rom_save_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rom_id INTEGER NOT NULL,
        slot INTEGER NOT NULL,
        label TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(rom_id, slot)
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS play_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rom_id INTEGER NOT NULL,
        rom_title TEXT NOT NULL,
        rom_system TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        duration_seconds INTEGER
      );
    `);
    for (const statement of [
      "ALTER TABLE uploaded_roms ADD COLUMN art_url TEXT",
      "ALTER TABLE uploaded_roms ADD COLUMN scrape_status TEXT NOT NULL DEFAULT 'not_scraped'",
      "ALTER TABLE uploaded_roms ADD COLUMN scrape_message TEXT",
      "ALTER TABLE uploaded_roms ADD COLUMN rating INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE uploaded_roms ADD COLUMN last_played INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE uploaded_roms ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE uploaded_roms ADD COLUMN disc_number INTEGER",
      "ALTER TABLE uploaded_roms ADD COLUMN disc_group TEXT",
      "ALTER TABLE uploaded_roms ADD COLUMN description TEXT",
      "ALTER TABLE uploaded_roms ADD COLUMN release_year INTEGER",
      "ALTER TABLE uploaded_roms ADD COLUMN developer TEXT",
      "ALTER TABLE uploaded_roms ADD COLUMN publisher TEXT",
      "ALTER TABLE uploaded_roms ADD COLUMN genre TEXT",
      "ALTER TABLE uploaded_roms ADD COLUMN players TEXT",
      "ALTER TABLE uploaded_roms ADD COLUMN rom_hash TEXT",
      "ALTER TABLE uploaded_roms ADD COLUMN minutes_played INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE uploaded_roms ADD COLUMN play_status TEXT NOT NULL DEFAULT 'unset'",
      "ALTER TABLE uploaded_roms ADD COLUMN community_score INTEGER",
      "ALTER TABLE uploaded_roms ADD COLUMN wheel_art_url TEXT",
      "ALTER TABLE uploaded_roms ADD COLUMN video_url TEXT",
      "ALTER TABLE uploaded_roms ADD COLUMN ra_game_id INTEGER",
      "ALTER TABLE game_collections ADD COLUMN smart_filter TEXT",
      "ALTER TABLE rom_save_slots ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default'",
      "CREATE UNIQUE INDEX IF NOT EXISTS rom_save_slots_user_idx ON rom_save_slots (rom_id, user_id, slot)",
      "CREATE TABLE IF NOT EXISTS play_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, rom_id INTEGER NOT NULL, rom_title TEXT NOT NULL, rom_system TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, duration_seconds INTEGER)",
      "CREATE TABLE IF NOT EXISTS user_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#8b5cf6', created_at INTEGER NOT NULL)",
      "INSERT OR IGNORE INTO user_profiles (id, name, color, created_at) VALUES (1, 'Player 1', '#8b5cf6', " + String(Date.now()) + ")",
      "CREATE TABLE IF NOT EXISTS game_cheat_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, rom_id INTEGER NOT NULL, profile_id INTEGER NOT NULL DEFAULT 1, description TEXT NOT NULL, code TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)",
      "CREATE TABLE IF NOT EXISTS profile_game_state (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL, rom_id INTEGER NOT NULL, favorite INTEGER, rating INTEGER, play_status TEXT, updated_at INTEGER NOT NULL, UNIQUE(profile_id, rom_id))",
      "CREATE TABLE IF NOT EXISTS profile_control_bindings (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL, core TEXT NOT NULL, bindings TEXT NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(profile_id, core))",
      "CREATE TABLE IF NOT EXISTS gamepad_bindings (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL DEFAULT 1, gamepad_id TEXT NOT NULL DEFAULT 'default', bindings TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL, UNIQUE(profile_id, gamepad_id))",
      "CREATE TABLE IF NOT EXISTS cheat_index_cache (id INTEGER PRIMARY KEY AUTOINCREMENT, folder TEXT NOT NULL UNIQUE, files_json TEXT NOT NULL, cached_at INTEGER NOT NULL)",
      "CREATE TABLE IF NOT EXISTS cheat_file_cache (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE, cheats_json TEXT NOT NULL, cached_at INTEGER NOT NULL)",
    ]) {
      try {
        _sqlite.exec(statement);
      } catch {
        // Column already exists
      }
    }
  }
  return _sqlite;
}

const sqlite = new Proxy({} as Database.Database, {
  get: (target, prop) => {
    const s = getSqlite();
    const val = (s as any)[prop];
    return typeof val === "function" ? val.bind(s) : val;
  }
});

export const db = drizzle(sqlite);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUploadedRoms(): Promise<UploadedRom[]>;
  getUploadedRom(id: number): Promise<UploadedRom | undefined>;
  createUploadedRom(rom: InsertUploadedRom): Promise<UploadedRom>;
  deleteUploadedRom(id: number): Promise<UploadedRom | undefined>;
  updateUploadedRomArt(
    id: number,
    art: Pick<InsertUploadedRom, "artUrl" | "scrapeStatus" | "scrapeMessage">,
  ): Promise<UploadedRom | undefined>;
  updateUploadedRomRating(id: number, rating: number): Promise<UploadedRom | undefined>;
  updateUploadedRomFavorite(id: number, favorite: boolean): Promise<UploadedRom | undefined>;
  markUploadedRomPlayed(id: number): Promise<UploadedRom | undefined>;
  listRomsByDiscGroup(discGroup: string): Promise<UploadedRom[]>;
  incrementRomMinutesPlayed(id: number, minutes: number): Promise<UploadedRom | undefined>;
  updateUploadedRomPlayStatus(id: number, status: string): Promise<UploadedRom | undefined>;
  createPlaySession(romId: number, romTitle: string, romSystem: string, startedAt: number): Promise<number>;
  endPlaySession(sessionId: number, endedAt: number, durationSeconds: number): Promise<void>;
  listRecentSessions(limit?: number): Promise<Array<{ id: number; romId: number; romTitle: string; romSystem: string; startedAt: number; endedAt: number | null; durationSeconds: number | null }>>;
  updateUploadedRomMetadata(
    id: number,
    meta: Partial<Pick<InsertUploadedRom, "description" | "releaseYear" | "developer" | "publisher" | "genre" | "players" | "artUrl" | "scrapeStatus" | "scrapeMessage" | "communityScore" | "wheelArtUrl" | "videoUrl">>,
  ): Promise<UploadedRom | undefined>;
  listCollections(): Promise<GameCollectionWithItems[]>;
  addScannedRom(rom: { title: string; system: string; slug: string; originalName: string; fileName: string; filePath: string; size: number; mimeType: string; createdAt: number }): Promise<UploadedRom>;
  listRomFilenames(): Promise<string[]>;
  addScannedRom(rom: { title: string; system: string; slug: string; originalName: string; fileName: string; filePath: string; size: number; mimeType: string; createdAt: number }): Promise<UploadedRom>;
  listRomFilenames(): Promise<string[]>;
  createCollection(collection: InsertGameCollection): Promise<GameCollection>;
  deleteCollection(id: number): Promise<boolean>;
  renameCollection(id: number, name: string): Promise<GameCollection | undefined>;
  addRomToCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined>;
  removeRomFromCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined>;
  listRomSaveSlots(romId: number, userId: string): Promise<RomSaveSlot[]>;
  upsertRomSaveSlot(saveSlot: InsertRomSaveSlot): Promise<RomSaveSlot>;
  deleteRomSaveSlot(romId: number, slot: number, userId: string): Promise<boolean>;
  getIntegrationSettings(): Promise<IntegrationSettings>;
  saveIntegrationSettings(settings: IntegrationSettings): Promise<IntegrationSettings>;
  // Profiles
  listProfiles(): Promise<import("../shared/schema").UserProfile[]>;
  createProfile(name: string, color: string): Promise<import("../shared/schema").UserProfile>;
  deleteProfile(id: number): Promise<boolean>;
  // Cheats
  listCheats(romId: number, profileId: number): Promise<import("../shared/schema").GameCheatCode[]>;
  createCheat(cheat: import("../shared/schema").InsertGameCheatCode): Promise<import("../shared/schema").GameCheatCode>;
  updateCheatEnabled(id: number, enabled: boolean): Promise<boolean>;
  deleteCheat(id: number): Promise<boolean>;
  // Per-profile game state
  getProfileGameState(profileId: number, romId: number): Promise<import("../shared/schema").ProfileGameState | undefined>;
  upsertProfileGameState(profileId: number, romId: number, patch: { favorite?: boolean; rating?: number; playStatus?: string }): Promise<import("../shared/schema").ProfileGameState>;
  listProfileGameStates(profileId: number): Promise<import("../shared/schema").ProfileGameState[]>;
  // Per-profile control bindings
  getProfileControlBindings(profileId: number, core: string): Promise<Record<number, string>>;
  setProfileControlBindings(profileId: number, core: string, bindings: Record<number, string>): Promise<void>;
  // Gamepad bindings
  getGamepadBindings(profileId: number, gamepadId: string): Promise<Record<number, number>>;
  setGamepadBindings(profileId: number, gamepadId: string, bindings: Record<number, number>): Promise<void>;
  listGamepadBindings(profileId: number): Promise<Array<{ gamepadId: string; bindings: Record<number, number> }>>;
  // Cheat cache
  getCheatIndex(folder: string): Promise<{ name: string; path: string }[] | null>;
  setCheatIndex(folder: string, files: { name: string; path: string }[]): Promise<void>;
  getCachedCheats(path: string): Promise<{ desc: string; code: string }[] | null>;
  setCachedCheats(path: string, cheats: { desc: string; code: string }[]): Promise<void>;
  clearCheatCache(): Promise<void>;
  // HLTB cache
  getHltbCache(romId: number): Promise<HltbCache | null>;
  saveHltbCache(data: { romId: number; hltbTitle: string | null; mainStory: number | null; mainExtra: number | null; completionist: number | null; cachedAt: number }): Promise<void>;
  // Activity Log
  listActivityLog(limit?: number): Promise<import("../shared/schema").ActivityLogEntry[]>;
  addActivityLogEntry(entry: import("../shared/schema").InsertActivityLog): Promise<import("../shared/schema").ActivityLogEntry>;
  clearActivityLog(): Promise<void>;
}

const INTEGRATION_SETTINGS_KEY = "integration";

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.username, username)).get();
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return db.insert(users).values(insertUser).returning().get();
  }

  async listUploadedRoms(): Promise<UploadedRom[]> {
    return db.select().from(uploadedRoms).orderBy(desc(uploadedRoms.createdAt)).all();
  }

  async getUploadedRom(id: number): Promise<UploadedRom | undefined> {
    return db.select().from(uploadedRoms).where(eq(uploadedRoms.id, id)).get();
  }

  async listRomsByDiscGroup(discGroup: string): Promise<UploadedRom[]> {
    return db
      .select()
      .from(uploadedRoms)
      .where(eq(uploadedRoms.discGroup, discGroup))
      .orderBy(uploadedRoms.discNumber)
      .all();
  }

  async createUploadedRom(rom: InsertUploadedRom): Promise<UploadedRom> {
    return db.insert(uploadedRoms).values(rom).returning().get();
  }

  async incrementRomMinutesPlayed(id: number, minutes: number): Promise<UploadedRom | undefined> {
    const rom = await this.getUploadedRom(id);
    if (!rom) return undefined;
    return db
      .update(uploadedRoms)
      .set({ minutesPlayed: (rom.minutesPlayed ?? 0) + Math.max(0, Math.round(minutes)) })
      .where(eq(uploadedRoms.id, id))
      .returning()
      .get();
  }

  async updateUploadedRomMetadata(
    id: number,
    meta: Partial<Pick<InsertUploadedRom, "description" | "releaseYear" | "developer" | "publisher" | "genre" | "players" | "artUrl" | "scrapeStatus" | "scrapeMessage" | "communityScore" | "wheelArtUrl" | "videoUrl">>,
  ): Promise<UploadedRom | undefined> {
    return db
      .update(uploadedRoms)
      .set(meta)
      .where(eq(uploadedRoms.id, id))
      .returning()
      .get();
  }

  async deleteUploadedRom(id: number): Promise<UploadedRom | undefined> {
    const rom = await this.getUploadedRom(id);    if (!rom) return undefined;

    db.delete(collectionItems).where(eq(collectionItems.romId, id)).run();
    db.delete(romSaveSlots).where(eq(romSaveSlots.romId, id)).run();
    db.delete(uploadedRoms).where(eq(uploadedRoms.id, id)).run();

    return rom;
  }

  async updateUploadedRomArt(
    id: number,
    art: Pick<InsertUploadedRom, "artUrl" | "scrapeStatus" | "scrapeMessage">,
  ): Promise<UploadedRom | undefined> {
    return db
      .update(uploadedRoms)
      .set(art)
      .where(eq(uploadedRoms.id, id))
      .returning()
      .get();
  }

  async updateUploadedRomPlayStatus(id: number, status: string): Promise<UploadedRom | undefined> {
    return db.update(uploadedRoms)
      .set({ playStatus: status })
      .where(eq(uploadedRoms.id, id)).returning().get();
  }

  async updateUploadedRomRating(id: number, rating: number): Promise<UploadedRom | undefined> {
    return db
      .update(uploadedRoms)
      .set({ rating })
      .where(eq(uploadedRoms.id, id))
      .returning()
      .get();
  }

  async updateUploadedRomFavorite(id: number, favorite: boolean): Promise<UploadedRom | undefined> {
    return db
      .update(uploadedRoms)
      .set({ favorite })
      .where(eq(uploadedRoms.id, id))
      .returning()
      .get();
  }

  async markUploadedRomPlayed(id: number): Promise<UploadedRom | undefined> {
    const rom = await this.getUploadedRom(id);
    if (!rom) return undefined;

    return db
      .update(uploadedRoms)
      .set({
        lastPlayed: Date.now(),
        playCount: (rom.playCount ?? 0) + 1,
      })
      .where(eq(uploadedRoms.id, id))
      .returning()
      .get();
  }

  async listCollections(): Promise<GameCollectionWithItems[]> {
    const collections = db.select().from(gameCollections).orderBy(desc(gameCollections.createdAt)).all();
    const items = db.select().from(collectionItems).all();
    return collections.map((collection) => ({
      ...collection,
      smartFilter: collection.smartFilter ? JSON.parse(collection.smartFilter) : undefined,
      romIds: items
        .filter((item) => item.collectionId === collection.id)
        .map((item) => item.romId),
    }));
  }

  async createCollection(collection: InsertGameCollection): Promise<GameCollection> {
    return db.insert(gameCollections).values(collection).returning().get();
  }

  async deleteCollection(id: number): Promise<boolean> {
    db.delete(collectionItems).where(eq(collectionItems.collectionId, id)).run();
    const result = db.delete(gameCollections).where(eq(gameCollections.id, id)).run();
    return result.changes > 0;
  }

  async renameCollection(id: number, name: string): Promise<GameCollection | undefined> {
    return db.update(gameCollections).set({ name }).where(eq(gameCollections.id, id)).returning().get();
  }

  async addRomToCollection(
    collectionId: number,
    romId: number,
  ): Promise<GameCollectionWithItems | undefined> {
    const collection = db.select().from(gameCollections).where(eq(gameCollections.id, collectionId)).get();
    const rom = await this.getUploadedRom(romId);
    if (!collection || !rom) return undefined;

    const existing = db
      .select()
      .from(collectionItems)
      .where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.romId, romId)))
      .get();
    if (!existing) {
      db.insert(collectionItems)
        .values({ collectionId, romId, createdAt: Date.now() })
        .run();
    }

    const collections = await this.listCollections();
    return collections.find((item) => item.id === collectionId);
  }

  async removeRomFromCollection(
    collectionId: number,
    romId: number,
  ): Promise<GameCollectionWithItems | undefined> {
    const collection = db.select().from(gameCollections).where(eq(gameCollections.id, collectionId)).get();
    if (!collection) return undefined;

    db.delete(collectionItems)
      .where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.romId, romId)))
      .run();

    const collections = await this.listCollections();
    return collections.find((item) => item.id === collectionId);
  }

  async listRomSaveSlots(romId: number, userId: string): Promise<RomSaveSlot[]> {
    return db
      .select()
      .from(romSaveSlots)
      .where(and(eq(romSaveSlots.romId, romId), eq(romSaveSlots.userId, userId)))
      .orderBy(romSaveSlots.slot)
      .all();
  }

  async upsertRomSaveSlot(saveSlot: InsertRomSaveSlot): Promise<RomSaveSlot> {
    const existing = db
      .select()
      .from(romSaveSlots)
      .where(and(eq(romSaveSlots.romId, saveSlot.romId), eq(romSaveSlots.userId, saveSlot.userId ?? "default"), eq(romSaveSlots.slot, saveSlot.slot)))
      .get();

    if (existing) {
      return db
        .update(romSaveSlots)
        .set({ label: saveSlot.label, updatedAt: saveSlot.updatedAt })
        .where(eq(romSaveSlots.id, existing.id))
        .returning()
        .get();
    }

    return db.insert(romSaveSlots).values(saveSlot).returning().get();
  }

  async deleteRomSaveSlot(romId: number, slot: number, userId: string): Promise<boolean> {
    const result = db
      .delete(romSaveSlots)
      .where(and(eq(romSaveSlots.romId, romId), eq(romSaveSlots.userId, userId), eq(romSaveSlots.slot, slot)))
      .run();
    return result.changes > 0;
  }

  async createPlaySession(romId: number, romTitle: string, romSystem: string, startedAt: number): Promise<number> {
    const result = sqlite.prepare(
      "INSERT INTO play_sessions (rom_id, rom_title, rom_system, started_at) VALUES (?, ?, ?, ?)"
    ).run(romId, romTitle, romSystem, startedAt);
    return result.lastInsertRowid as number;
  }

  async endPlaySession(sessionId: number, endedAt: number, durationSeconds: number): Promise<void> {
    sqlite.prepare(
      "UPDATE play_sessions SET ended_at = ?, duration_seconds = ? WHERE id = ?"
    ).run(endedAt, durationSeconds, sessionId);
  }

  async listRecentSessions(limit = 50): Promise<Array<{ id: number; romId: number; romTitle: string; romSystem: string; startedAt: number; endedAt: number | null; durationSeconds: number | null }>> {
    const rows = sqlite.prepare(
      "SELECT id, rom_id, rom_title, rom_system, started_at, ended_at, duration_seconds FROM play_sessions ORDER BY started_at DESC LIMIT ?"
    ).all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as number,
      romId: r.rom_id as number,
      romTitle: r.rom_title as string,
      romSystem: r.rom_system as string,
      startedAt: r.started_at as number,
      endedAt: (r.ended_at ?? null) as number | null,
      durationSeconds: (r.duration_seconds ?? null) as number | null,
    }));
  }

  async getIntegrationSettings(): Promise<IntegrationSettings> {
    const row = db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, INTEGRATION_SETTINGS_KEY))
      .get();
    if (!row) return { ...DEFAULT_INTEGRATION_SETTINGS };
    try {
      const parsed = integrationSettingsSchema.parse(JSON.parse(row.value));
      return parsed;
    } catch {
      return { ...DEFAULT_INTEGRATION_SETTINGS };
    }
  }

  async saveIntegrationSettings(
    settings: IntegrationSettings,
  ): Promise<IntegrationSettings> {
    const value = JSON.stringify(settings);
    const updatedAt = Date.now();
    const existing = db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, INTEGRATION_SETTINGS_KEY))
      .get();
    if (existing) {
      db.update(appSettings)
        .set({ value, updatedAt })
        .where(eq(appSettings.key, INTEGRATION_SETTINGS_KEY))
        .run();
    } else {
      db.insert(appSettings)
        .values({ key: INTEGRATION_SETTINGS_KEY, value, updatedAt })
        .run();
    }
    return settings;
  }

  // ── Profiles ─────────────────────────────────────────────────────────────────────────────
  async listProfiles() {
    const { userProfiles } = await import("../shared/schema");
    return db.select().from(userProfiles).all();
  }
  async createProfile(name: string, color: string) {
    const { userProfiles } = await import("../shared/schema");
    return db.insert(userProfiles).values({ name, color, createdAt: Date.now() }).returning().get();
  }
  async deleteProfile(id: number): Promise<boolean> {
    if (id === 1) return false; // protect default
    const { userProfiles } = await import("../shared/schema");
    const result = db.delete(userProfiles).where(eq(userProfiles.id, id)).run();
    return result.changes > 0;
  }

  // ── Cheats ────────────────────────────────────────────────────────────────────────────────
  async listCheats(romId: number, profileId: number) {
    const { gameCheatCodes } = await import("../shared/schema");
    return db.select().from(gameCheatCodes)
      .where(and(eq(gameCheatCodes.romId, romId), eq(gameCheatCodes.profileId, profileId)))
      .all();
  }
  async createCheat(cheat: import("../shared/schema").InsertGameCheatCode) {
    const { gameCheatCodes } = await import("../shared/schema");
    return db.insert(gameCheatCodes).values(cheat).returning().get();
  }
  async updateCheatEnabled(id: number, enabled: boolean): Promise<boolean> {
    const { gameCheatCodes } = await import("../shared/schema");
    const result = db.update(gameCheatCodes).set({ enabled }).where(eq(gameCheatCodes.id, id)).run();
    return result.changes > 0;
  }
  async deleteCheat(id: number): Promise<boolean> {
    const { gameCheatCodes } = await import("../shared/schema");
    const result = db.delete(gameCheatCodes).where(eq(gameCheatCodes.id, id)).run();
    return result.changes > 0;
  }

  // ── Per-profile game state ───────────────────────────────────────────────────────────────────────
  async getProfileGameState(profileId: number, romId: number) {
    const row = sqlite.prepare(
      "SELECT * FROM profile_game_state WHERE profile_id=? AND rom_id=?"
    ).get(profileId, romId) as import("../shared/schema").ProfileGameState | undefined;
    return row;
  }
  async upsertProfileGameState(profileId: number, romId: number, patch: { favorite?: boolean; rating?: number; playStatus?: string }) {
    const now = Date.now();
    const existing = await this.getProfileGameState(profileId, romId);
    if (existing) {
      const sets: string[] = ["updated_at=?"];
      const vals: unknown[] = [now];
      if (patch.favorite !== undefined) { sets.push("favorite=?"); vals.push(patch.favorite ? 1 : 0); }
      if (patch.rating !== undefined) { sets.push("rating=?"); vals.push(patch.rating); }
      if (patch.playStatus !== undefined) { sets.push("play_status=?"); vals.push(patch.playStatus); }
      vals.push(existing.id);
      sqlite.prepare(`UPDATE profile_game_state SET ${sets.join(",")} WHERE id=?`).run(...vals);
    } else {
      sqlite.prepare(
        "INSERT INTO profile_game_state (profile_id, rom_id, favorite, rating, play_status, updated_at) VALUES (?,?,?,?,?,?)"
      ).run(profileId, romId, patch.favorite !== undefined ? (patch.favorite ? 1 : 0) : null, patch.rating ?? null, patch.playStatus ?? null, now);
    }
    return (await this.getProfileGameState(profileId, romId))!;
  }
  async listProfileGameStates(profileId: number) {
    return sqlite.prepare("SELECT * FROM profile_game_state WHERE profile_id=?").all(profileId) as import("../shared/schema").ProfileGameState[];
  }

  // ── Per-profile control bindings ──────────────────────────────────────────────────────────────────────
  async getProfileControlBindings(profileId: number, core: string): Promise<Record<number, string>> {
    const row = sqlite.prepare("SELECT bindings FROM profile_control_bindings WHERE profile_id=? AND core=?").get(profileId, core) as { bindings: string } | undefined;
    if (!row) return {};
    try { return JSON.parse(row.bindings); } catch { return {}; }
  }
  async setProfileControlBindings(profileId: number, core: string, bindings: Record<number, string>): Promise<void> {
    const now = Date.now();
    sqlite.prepare(
      "INSERT INTO profile_control_bindings (profile_id, core, bindings, updated_at) VALUES (?,?,?,?) ON CONFLICT(profile_id, core) DO UPDATE SET bindings=excluded.bindings, updated_at=excluded.updated_at"
    ).run(profileId, core, JSON.stringify(bindings), now);
  }

  // ── Gamepad bindings ──────────────────────────────────────────────────────────────────────────────
  async getGamepadBindings(profileId: number, gamepadId: string): Promise<Record<number, number>> {
    const row = sqlite.prepare(
      "SELECT bindings FROM gamepad_bindings WHERE profile_id=? AND gamepad_id=?"
    ).get(profileId, gamepadId) as { bindings: string } | undefined;
    // Fall back to "default" slot if specific gamepad not found
    const fallback = gamepadId !== "default"
      ? sqlite.prepare("SELECT bindings FROM gamepad_bindings WHERE profile_id=? AND gamepad_id='default'").get(profileId) as { bindings: string } | undefined
      : undefined;
    const raw = row ?? fallback;
    if (!raw) return {};
    try { return JSON.parse(raw.bindings); } catch { return {}; }
  }
  async setGamepadBindings(profileId: number, gamepadId: string, bindings: Record<number, number>): Promise<void> {
    const now = Date.now();
    sqlite.prepare(
      "INSERT INTO gamepad_bindings (profile_id, gamepad_id, bindings, updated_at) VALUES (?,?,?,?) ON CONFLICT(profile_id, gamepad_id) DO UPDATE SET bindings=excluded.bindings, updated_at=excluded.updated_at"
    ).run(profileId, gamepadId, JSON.stringify(bindings), now);
  }
  async listGamepadBindings(profileId: number) {
    const rows = sqlite.prepare(
      "SELECT gamepad_id, bindings FROM gamepad_bindings WHERE profile_id=?"
    ).all(profileId) as Array<{ gamepad_id: string; bindings: string }>;
    return rows.map((r) => ({
      gamepadId: r.gamepad_id,
      bindings: (() => { try { return JSON.parse(r.bindings) as Record<number, number>; } catch { return {}; } })(),
    }));
  }

  // ── Cheat cache ────────────────────────────────────────────────────────────────────────────────────
  private static CHEAT_INDEX_TTL = 7 * 24 * 60 * 60 * 1000;  // 7 days
  private static CHEAT_FILE_TTL  = 30 * 24 * 60 * 60 * 1000; // 30 days

  async getCheatIndex(folder: string): Promise<{ name: string; path: string }[] | null> {
    const row = sqlite.prepare(
      "SELECT files_json, cached_at FROM cheat_index_cache WHERE folder=?"
    ).get(folder) as { files_json: string; cached_at: number } | undefined;
    if (!row) return null;
    if (Date.now() - row.cached_at > DatabaseStorage.CHEAT_INDEX_TTL) return null;
    try { return JSON.parse(row.files_json) as { name: string; path: string }[]; } catch { return null; }
  }

  async setCheatIndex(folder: string, files: { name: string; path: string }[]): Promise<void> {
    sqlite.prepare(
      "INSERT INTO cheat_index_cache (folder, files_json, cached_at) VALUES (?,?,?) ON CONFLICT(folder) DO UPDATE SET files_json=excluded.files_json, cached_at=excluded.cached_at"
    ).run(folder, JSON.stringify(files), Date.now());
  }

  async getCachedCheats(path: string): Promise<{ desc: string; code: string }[] | null> {
    const row = sqlite.prepare(
      "SELECT cheats_json, cached_at FROM cheat_file_cache WHERE path=?"
    ).get(path) as { cheats_json: string; cached_at: number } | undefined;
    if (!row) return null;
    if (Date.now() - row.cached_at > DatabaseStorage.CHEAT_FILE_TTL) return null;
    try { return JSON.parse(row.cheats_json) as { desc: string; code: string }[]; } catch { return null; }
  }

  async setCachedCheats(path: string, cheats: { desc: string; code: string }[]): Promise<void> {
    sqlite.prepare(
      "INSERT INTO cheat_file_cache (path, cheats_json, cached_at) VALUES (?,?,?) ON CONFLICT(path) DO UPDATE SET cheats_json=excluded.cheats_json, cached_at=excluded.cached_at"
    ).run(path, JSON.stringify(cheats), Date.now());
  }

  async clearCheatCache(): Promise<void> {
    sqlite.exec("DELETE FROM cheat_index_cache");
    sqlite.exec("DELETE FROM cheat_file_cache");
  }

  // ── HLTB cache ────────────────────────────────────────────────────────────────────────────────────
  async getHltbCache(romId: number): Promise<HltbCache | null> {
    const row = sqlite.prepare(
      "SELECT * FROM hltb_cache WHERE rom_id=?"
    ).get(romId) as HltbCache | undefined;
    return row ?? null;
  }

  async saveHltbCache(data: { romId: number; hltbTitle: string | null; mainStory: number | null; mainExtra: number | null; completionist: number | null; cachedAt: number }): Promise<void> {
    sqlite.prepare(
      "INSERT INTO hltb_cache (rom_id, hltb_title, main_story, main_extra, completionist, cached_at) VALUES (?,?,?,?,?,?) ON CONFLICT(rom_id) DO UPDATE SET hltb_title=excluded.hltb_title, main_story=excluded.main_story, main_extra=excluded.main_extra, completionist=excluded.completionist, cached_at=excluded.cached_at"
    ).run(data.romId, data.hltbTitle, data.mainStory, data.mainExtra, data.completionist, data.cachedAt);
  }

  async addScannedRom(rom: { title: string; system: string; slug: string; originalName: string; fileName: string; filePath: string; size: number; mimeType: string; createdAt: number }): Promise<UploadedRom> {
    return sqlite.prepare(
      "INSERT INTO uploaded_roms (title, system, slug, original_name, file_name, file_path, size, mime_type, created_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING *"
    ).get(rom.title, rom.system, rom.slug, rom.originalName, rom.fileName, rom.filePath, rom.size, rom.mimeType, rom.createdAt) as UploadedRom;
  }

  async listRomFilenames(): Promise<string[]> {
    return (sqlite.prepare("SELECT file_name FROM uploaded_roms").all() as { file_name: string }[]).map((r) => r.file_name);
  }

  // ── Activity Log ──────────────────────────────────────────────────────────────────────────────────
  async listActivityLog(limit = 100): Promise<import("../shared/schema").ActivityLogEntry[]> {
    const rows = sqlite.prepare(
      "SELECT * FROM activity_log ORDER BY ts DESC LIMIT ?"
    ).all(limit) as import("../shared/schema").ActivityLogEntry[];
    return rows;
  }

  async addActivityLogEntry(entry: import("../shared/schema").InsertActivityLog): Promise<import("../shared/schema").ActivityLogEntry> {
    return sqlite.prepare(
      "INSERT INTO activity_log (ts, label, endpoint, status, detail) VALUES (?,?,?,?,?) RETURNING *"
    ).get(entry.ts, entry.label, entry.endpoint, entry.status, entry.detail ?? null) as import("../shared/schema").ActivityLogEntry;
  }

  async clearActivityLog(): Promise<void> {
    sqlite.exec("DELETE FROM activity_log");
  }
}

export const storage = new DatabaseStorage();

// ── ProfileGameState + ProfileControlBindings (appended by v0.6.0) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Migrations run at the bottom of the existing migration block above via try/catch.
// We call them here as a second-pass to ensure they exist even on fresh DBs.
(function ensureV6Tables() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS profile_game_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      rom_id INTEGER NOT NULL,
      favorite INTEGER,
      rating INTEGER,
      play_status TEXT,
      updated_at INTEGER NOT NULL,
      UNIQUE(profile_id, rom_id)
    )`,
    `CREATE TABLE IF NOT EXISTS profile_control_bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      core TEXT NOT NULL,
      bindings TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(profile_id, core)
    )`,
    `CREATE TABLE IF NOT EXISTS gamepad_bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL DEFAULT 1,
      gamepad_id TEXT NOT NULL DEFAULT 'default',
      bindings TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL,
      UNIQUE(profile_id, gamepad_id)
    )`,
    `CREATE TABLE IF NOT EXISTS cheat_index_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder TEXT NOT NULL UNIQUE,
      files_json TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cheat_file_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      cheats_json TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS hltb_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rom_id INTEGER NOT NULL UNIQUE,
      hltb_title TEXT,
      main_story INTEGER,
      main_extra INTEGER,
      completionist INTEGER,
      cached_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      label TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      status TEXT NOT NULL,
      detail TEXT
    )`,
  ];
  for (const stmt of stmts) {
    try { sqlite.exec(stmt); } catch { /* already exists */ }
  }
})();
