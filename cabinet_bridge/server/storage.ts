import { 
  appSettings, collectionItems, gameCollections, hltbCache, romSaveSlots, 
  uploadedRoms, users, userProfiles, gameCheatCodes, profileGameState, 
  profileControlBindings, gamepadBindings, cheatIndexCache, cheatFileCache, 
  activityLog 
} from '@shared/schema';
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
import { log } from "./log";

// Global references initialized during boot
export let sqlite: Database.Database;
export let db: any;

/**
 * Explicitly initialize the database.
 * This must be called from the main boot block in index.ts.
 */
export function initializeDatabase() {
  if (sqlite) return;

  try {
    const dataDir = getDataDir();
    ensureDir(dataDir);
    const dbPath = dataPath("data.db");
    
    log(`Connecting to SQLite at ${dbPath}`, "db");
    sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    
    // Core Schema Creation
    sqlite.exec(`
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
    `);

    // Incremental Migrations (Ensuring columns exist)
    const migrations = [
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
      "CREATE TABLE IF NOT EXISTS game_cheat_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, rom_id INTEGER NOT NULL, profile_id INTEGER NOT NULL DEFAULT 1, description TEXT NOT NULL, code TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)",
      "CREATE TABLE IF NOT EXISTS profile_game_state (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL, rom_id INTEGER NOT NULL, favorite INTEGER, rating INTEGER, play_status TEXT, updated_at INTEGER NOT NULL, UNIQUE(profile_id, rom_id))",
      "CREATE TABLE IF NOT EXISTS profile_control_bindings (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL, core TEXT NOT NULL, bindings TEXT NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(profile_id, core))",
      "CREATE TABLE IF NOT EXISTS gamepad_bindings (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL DEFAULT 1, gamepad_id TEXT NOT NULL DEFAULT 'default', bindings TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL, UNIQUE(profile_id, gamepad_id))",
      "CREATE TABLE IF NOT EXISTS cheat_index_cache (id INTEGER PRIMARY KEY AUTOINCREMENT, folder TEXT NOT NULL UNIQUE, files_json TEXT NOT NULL, cached_at INTEGER NOT NULL)",
      "CREATE TABLE IF NOT EXISTS cheat_file_cache (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE, cheats_json TEXT NOT NULL, cached_at INTEGER NOT NULL)",
      "CREATE TABLE IF NOT EXISTS hltb_cache (id INTEGER PRIMARY KEY AUTOINCREMENT, rom_id INTEGER NOT NULL UNIQUE, hltb_title TEXT, main_story INTEGER, main_extra INTEGER, completionist INTEGER, cached_at INTEGER NOT NULL)",
      "CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, label TEXT NOT NULL, endpoint TEXT NOT NULL, status TEXT NOT NULL, detail TEXT)",
    ];

    for (const stmt of migrations) {
      try { sqlite.exec(stmt); } catch { /* ignore existing column/table errors */ }
    }

    // Default Profile Seeding
    try {
      const exists = sqlite.prepare("SELECT id FROM user_profiles WHERE id = 1").get();
      if (!exists) {
        sqlite.prepare("INSERT INTO user_profiles (id, name, color, created_at) VALUES (1, 'Player 1', '#8b5cf6', ?)").run(Date.now());
      }
    } catch (e) {
       log("Profile seed failed (non-critical)", "db");
    }

    db = drizzle(sqlite);
    log("Database initialized successfully", "db");
  } catch (err) {
    log("CRITICAL: Database initialization failed!", "db");
    throw err;
  }
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUploadedRoms(): Promise<UploadedRom[]>;
  getUploadedRom(id: number): Promise<UploadedRom | undefined>;
  createUploadedRom(rom: InsertUploadedRom): Promise<UploadedRom>;
  deleteUploadedRom(id: number): Promise<UploadedRom | undefined>;
  updateUploadedRomArt(id: number, art: any): Promise<UploadedRom | undefined>;
  updateUploadedRomRating(id: number, rating: number): Promise<UploadedRom | undefined>;
  updateUploadedRomFavorite(id: number, favorite: boolean): Promise<UploadedRom | undefined>;
  markUploadedRomPlayed(id: number): Promise<UploadedRom | undefined>;
  listRomsByDiscGroup(discGroup: string): Promise<UploadedRom[]>;
  incrementRomMinutesPlayed(id: number, minutes: number): Promise<UploadedRom | undefined>;
  updateUploadedRomPlayStatus(id: number, status: string): Promise<UploadedRom | undefined>;
  createPlaySession(romId: number, romTitle: string, romSystem: string, startedAt: number): Promise<number>;
  endPlaySession(sessionId: number, endedAt: number, durationSeconds: number): Promise<void>;
  listRecentSessions(limit?: number): Promise<any[]>;
  updateUploadedRomMetadata(id: number, meta: any): Promise<UploadedRom | undefined>;
  listCollections(): Promise<GameCollectionWithItems[]>;
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
  listProfiles(): Promise<UserProfile[]>;
  createProfile(name: string, color: string): Promise<UserProfile>;
  deleteProfile(id: number): Promise<boolean>;
  listCheats(romId: number, profileId: number): Promise<any[]>;
  createCheat(cheat: any): Promise<any>;
  updateCheatEnabled(id: number, enabled: boolean): Promise<boolean>;
  deleteCheat(id: number): Promise<boolean>;
  getProfileGameState(profileId: number, romId: number): Promise<any>;
  upsertProfileGameState(profileId: number, romId: number, patch: any): Promise<any>;
  listProfileGameStates(profileId: number): Promise<any[]>;
  getProfileControlBindings(profileId: number, core: string): Promise<any>;
  setProfileControlBindings(profileId: number, core: string, bindings: any): Promise<void>;
  getGamepadBindings(profileId: number, gamepadId: string): Promise<any>;
  setGamepadBindings(profileId: number, gamepadId: string, bindings: any): Promise<void>;
  listGamepadBindings(profileId: number): Promise<any[]>;
  getCheatIndex(folder: string): Promise<any>;
  setCheatIndex(folder: string, files: any[]): Promise<void>;
  getCachedCheats(path: string): Promise<any>;
  setCachedCheats(path: string, cheats: any[]): Promise<void>;
  clearCheatCache(): Promise<void>;
  getHltbCache(romId: number): Promise<any>;
  saveHltbCache(data: any): Promise<void>;
  addScannedRom(rom: any): Promise<UploadedRom>;
  listRomFilenames(): Promise<string[]>;
  listActivityLog(limit?: number): Promise<any[]>;
  addActivityLogEntry(entry: any): Promise<any>;
  clearActivityLog(): Promise<void>;
}

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
    return db.select().from(uploadedRoms).where(eq(uploadedRoms.discGroup, discGroup)).orderBy(uploadedRoms.discNumber).all();
  }
  async createUploadedRom(rom: InsertUploadedRom): Promise<UploadedRom> {
    return db.insert(uploadedRoms).values(rom).returning().get();
  }
  async incrementRomMinutesPlayed(id: number, minutes: number): Promise<UploadedRom | undefined> {
    const rom = await this.getUploadedRom(id);
    if (!rom) return undefined;
    return db.update(uploadedRoms).set({ minutesPlayed: (rom.minutesPlayed ?? 0) + Math.max(0, Math.round(minutes)) }).where(eq(uploadedRoms.id, id)).returning().get();
  }
  async updateUploadedRomMetadata(id: number, meta: any): Promise<UploadedRom | undefined> {
    return db.update(uploadedRoms).set(meta).where(eq(uploadedRoms.id, id)).returning().get();
  }
  async deleteUploadedRom(id: number): Promise<UploadedRom | undefined> {
    const rom = await this.getUploadedRom(id);
    if (!rom) return undefined;
    db.delete(collectionItems).where(eq(collectionItems.romId, id)).run();
    db.delete(romSaveSlots).where(eq(romSaveSlots.romId, id)).run();
    db.delete(uploadedRoms).where(eq(uploadedRoms.id, id)).run();
    return rom;
  }
  async updateUploadedRomArt(id: number, art: any): Promise<UploadedRom | undefined> {
    return db.update(uploadedRoms).set(art).where(eq(uploadedRoms.id, id)).returning().get();
  }
  async updateUploadedRomPlayStatus(id: number, status: string): Promise<UploadedRom | undefined> {
    return db.update(uploadedRoms).set({ playStatus: status }).where(eq(uploadedRoms.id, id)).returning().get();
  }
  async updateUploadedRomRating(id: number, rating: number): Promise<UploadedRom | undefined> {
    return db.update(uploadedRoms).set({ rating }).where(eq(uploadedRoms.id, id)).returning().get();
  }
  async updateUploadedRomFavorite(id: number, favorite: boolean): Promise<UploadedRom | undefined> {
    return db.update(uploadedRoms).set({ favorite: favorite ? 1 : 0 }).where(eq(uploadedRoms.id, id)).returning().get();
  }
  async markUploadedRomPlayed(id: number): Promise<UploadedRom | undefined> {
    const rom = await this.getUploadedRom(id);
    if (!rom) return undefined;
    return db.update(uploadedRoms).set({ lastPlayed: Date.now(), playCount: (rom.playCount ?? 0) + 1 }).where(eq(uploadedRoms.id, id)).returning().get();
  }
  async listCollections(): Promise<GameCollectionWithItems[]> {
    const collections_ = db.select().from(gameCollections).orderBy(desc(gameCollections.createdAt)).all();
    const items = db.select().from(collectionItems).all();
    return collections_.map((collection) => ({
      ...collection,
      smartFilter: collection.smartFilter ? JSON.parse(collection.smartFilter) : undefined,
      romIds: items.filter((item: any) => item.collectionId === collection.id).map((item: any) => item.romId),
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
  async addRomToCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined> {
    const collection = db.select().from(gameCollections).where(eq(gameCollections.id, collectionId)).get();
    const rom = await this.getUploadedRom(romId);
    if (!collection || !rom) return undefined;
    const existing = db.select().from(collectionItems).where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.romId, romId))).get();
    if (!existing) db.insert(collectionItems).values({ collectionId, romId, createdAt: Date.now() }).run();
    const collections_ = await this.listCollections();
    return collections_.find((item) => item.id === collectionId);
  }
  async removeRomFromCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined> {
    const collection = db.select().from(gameCollections).where(eq(gameCollections.id, collectionId)).get();
    if (!collection) return undefined;
    db.delete(collectionItems).where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.romId, romId))).run();
    const collections_ = await this.listCollections();
    return collections_.find((item) => item.id === collectionId);
  }
  async listRomSaveSlots(romId: number, userId: string): Promise<RomSaveSlot[]> {
    return db.select().from(romSaveSlots).where(and(eq(romSaveSlots.romId, romId), eq(romSaveSlots.userId, userId))).orderBy(romSaveSlots.slot).all();
  }
  async upsertRomSaveSlot(saveSlot: InsertRomSaveSlot): Promise<RomSaveSlot> {
    const existing = db.select().from(romSaveSlots).where(and(eq(romSaveSlots.romId, saveSlot.romId), eq(romSaveSlots.userId, saveSlot.userId ?? "default"), eq(romSaveSlots.slot, saveSlot.slot))).get();
    if (existing) return db.update(romSaveSlots).set({ label: saveSlot.label, updatedAt: saveSlot.updatedAt }).where(eq(romSaveSlots.id, existing.id)).returning().get();
    return db.insert(romSaveSlots).values(saveSlot).returning().get();
  }
  async deleteRomSaveSlot(romId: number, slot: number, userId: string): Promise<boolean> {
    const result = db.delete(romSaveSlots).where(and(eq(romSaveSlots.romId, romId), eq(romSaveSlots.userId, userId), eq(romSaveSlots.slot, slot))).run();
    return result.changes > 0;
  }
  async createPlaySession(romId: number, romTitle: string, romSystem: string, startedAt: number): Promise<number> {
    const result = sqlite.prepare("INSERT INTO play_sessions (rom_id, rom_title, rom_system, started_at) VALUES (?, ?, ?, ?)").run(romId, romTitle, romSystem, startedAt);
    return result.lastInsertRowid as number;
  }
  async endPlaySession(sessionId: number, endedAt: number, durationSeconds: number): Promise<void> {
    sqlite.prepare("UPDATE play_sessions SET ended_at = ?, duration_seconds = ? WHERE id = ?").run(endedAt, durationSeconds, sessionId);
  }
  async listRecentSessions(limit = 50): Promise<any[]> {
    const rows = sqlite.prepare("SELECT * FROM play_sessions ORDER BY started_at DESC LIMIT ?").all(limit);
    return rows.map((r: any) => ({
      id: r.id, romId: r.rom_id, romTitle: r.rom_title, romSystem: r.rom_system,
      startedAt: r.started_at, endedAt: r.ended_at ?? null, durationSeconds: r.duration_seconds ?? null,
    }));
  }
  async getIntegrationSettings(): Promise<IntegrationSettings> {
    const row = db.select().from(appSettings).where(eq(appSettings.key, INTEGRATION_SETTINGS_KEY)).get();
    if (!row) return { ...DEFAULT_INTEGRATION_SETTINGS };
    try { return integrationSettingsSchema.parse(JSON.parse(row.value)); } catch { return { ...DEFAULT_INTEGRATION_SETTINGS }; }
  }
  async saveIntegrationSettings(settings: IntegrationSettings): Promise<IntegrationSettings> {
    const value = JSON.stringify(settings);
    const updatedAt = Date.now();
    const existing = db.select().from(appSettings).where(eq(appSettings.key, INTEGRATION_SETTINGS_KEY)).get();
    if (existing) db.update(appSettings).set({ value, updatedAt }).where(eq(appSettings.key, INTEGRATION_SETTINGS_KEY)).run();
    else db.insert(appSettings).values({ key: INTEGRATION_SETTINGS_KEY, value, updatedAt }).run();
    return settings;
  }
  async listProfiles() { return db.select().from(userProfiles).all(); }
  async createProfile(name: string, color: string) { return db.insert(userProfiles).values({ name, color, createdAt: Date.now() }).returning().get(); }
  async deleteProfile(id: number) { if (id === 1) return false; return db.delete(userProfiles).where(eq(userProfiles.id, id)).run().changes > 0; }
  async listCheats(romId: number, profileId: number) { return db.select().from(gameCheatCodes).where(and(eq(gameCheatCodes.romId, romId), eq(gameCheatCodes.profileId, profileId))).all(); }
  async createCheat(cheat: any) { return db.insert(gameCheatCodes).values(cheat).returning().get(); }
  async updateCheatEnabled(id: number, enabled: boolean) { return db.update(gameCheatCodes).set({ enabled: enabled ? 1 : 0 }).where(eq(gameCheatCodes.id, id)).run().changes > 0; }
  async deleteCheat(id: number) { return db.delete(gameCheatCodes).where(eq(gameCheatCodes.id, id)).run().changes > 0; }
  async getProfileGameState(profileId: number, romId: number) { return sqlite.prepare("SELECT * FROM profile_game_state WHERE profile_id=? AND rom_id=?").get(profileId, romId) as any; }
  async upsertProfileGameState(profileId: number, romId: number, patch: any) {
    const now = Date.now();
    const existing = await this.getProfileGameState(profileId, romId);
    if (existing) {
      const sets: string[] = ["updated_at=?"];
      const vals: any[] = [now];
      if (patch.favorite !== undefined) { sets.push("favorite=?"); vals.push(patch.favorite ? 1 : 0); }
      if (patch.rating !== undefined) { sets.push("rating=?"); vals.push(patch.rating); }
      if (patch.playStatus !== undefined) { sets.push("play_status=?"); vals.push(patch.playStatus); }
      vals.push(existing.id);
      sqlite.prepare(`UPDATE profile_game_state SET ${sets.join(",")} WHERE id=?`).run(...vals);
    } else {
      sqlite.prepare("INSERT INTO profile_game_state (profile_id, rom_id, favorite, rating, play_status, updated_at) VALUES (?,?,?,?,?,?)").run(profileId, romId, patch.favorite !== undefined ? (patch.favorite ? 1 : 0) : null, patch.rating ?? null, patch.playStatus ?? null, now);
    }
    return (await this.getProfileGameState(profileId, romId))!;
  }
  async listProfileGameStates(profileId: number) { return sqlite.prepare("SELECT * FROM profile_game_state WHERE profile_id=?").all(profileId) as any[]; }
  async getProfileControlBindings(profileId: number, core: string) {
    const row = sqlite.prepare("SELECT bindings FROM profile_control_bindings WHERE profile_id=? AND core=?").get(profileId, core) as any;
    try { return JSON.parse(row?.bindings || "{}"); } catch { return {}; }
  }
  async setProfileControlBindings(profileId: number, core: string, bindings: any) { sqlite.prepare("INSERT INTO profile_control_bindings (profile_id, core, bindings, updated_at) VALUES (?,?,?,?) ON CONFLICT(profile_id, core) DO UPDATE SET bindings=excluded.bindings, updated_at=excluded.updated_at").run(profileId, core, JSON.stringify(bindings), Date.now()); }
  async getGamepadBindings(profileId: number, gamepadId: string) {
    const row = sqlite.prepare("SELECT bindings FROM gamepad_bindings WHERE profile_id=? AND gamepad_id=?").get(profileId, gamepadId) as any;
    const fallback = !row && gamepadId !== "default" ? sqlite.prepare("SELECT bindings FROM gamepad_bindings WHERE profile_id=? AND gamepad_id='default'").get(profileId) as any : null;
    try { return JSON.parse((row || fallback)?.bindings || "{}"); } catch { return {}; }
  }
  async setGamepadBindings(profileId: number, gamepadId: string, bindings: any) { sqlite.prepare("INSERT INTO gamepad_bindings (profile_id, gamepad_id, bindings, updated_at) VALUES (?,?,?,?) ON CONFLICT(profile_id, gamepad_id) DO UPDATE SET bindings=excluded.bindings, updated_at=excluded.updated_at").run(profileId, gamepadId, JSON.stringify(bindings), Date.now()); }
  async listGamepadBindings(profileId: number) {
    const rows = sqlite.prepare("SELECT gamepad_id, bindings FROM gamepad_bindings WHERE profile_id=?").all(profileId) as any[];
    return rows.map((r) => ({ gamepadId: r.gamepad_id, bindings: (() => { try { return JSON.parse(r.bindings); } catch { return {}; } })() }));
  }
  async getCheatIndex(folder: string) {
    const row = sqlite.prepare("SELECT files_json, cached_at FROM cheat_index_cache WHERE folder=?").get(folder) as any;
    if (!row || Date.now() - row.cached_at > 7 * 24 * 60 * 60 * 1000) return null;
    try { return JSON.parse(row.files_json); } catch { return null; }
  }
  async setCheatIndex(folder: string, files: any[]) { sqlite.prepare("INSERT INTO cheat_index_cache (folder, files_json, cached_at) VALUES (?,?,?) ON CONFLICT(folder) DO UPDATE SET files_json=excluded.files_json, cached_at=excluded.cached_at").run(folder, JSON.stringify(files), Date.now()); }
  async getCachedCheats(path: string) {
    const row = sqlite.prepare("SELECT cheats_json, cached_at FROM cheat_file_cache WHERE path=?").get(path) as any;
    if (!row || Date.now() - row.cached_at > 30 * 24 * 60 * 60 * 1000) return null;
    try { return JSON.parse(row.cheats_json); } catch { return null; }
  }
  async setCachedCheats(path: string, cheats: any[]) { sqlite.prepare("INSERT INTO cheat_file_cache (path, cheats_json, cached_at) VALUES (?,?,?) ON CONFLICT(path) DO UPDATE SET cheats_json=excluded.cheats_json, cached_at=excluded.cached_at").run(path, JSON.stringify(cheats), Date.now()); }
  async clearCheatCache() { sqlite.exec("DELETE FROM cheat_index_cache; DELETE FROM cheat_file_cache;"); }
  async getHltbCache(romId: number) { return sqlite.prepare("SELECT * FROM hltb_cache WHERE rom_id=?").get(romId) as any; }
  async saveHltbCache(data: any) { sqlite.prepare("INSERT INTO hltb_cache (rom_id, hltb_title, main_story, main_extra, completionist, cached_at) VALUES (?,?,?,?,?,?) ON CONFLICT(rom_id) DO UPDATE SET hltb_title=excluded.hltb_title, main_story=excluded.main_story, main_extra=excluded.main_extra, completionist=excluded.completionist, cached_at=excluded.cached_at").run(data.romId, data.hltbTitle, data.mainStory, data.mainExtra, data.completionist, data.cachedAt); }
  async addScannedRom(rom: any) { return sqlite.prepare("INSERT INTO uploaded_roms (title, system, slug, original_name, file_name, file_path, size, mime_type, created_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING *").get(rom.title, rom.system, rom.slug, rom.originalName, rom.fileName, rom.filePath, rom.size, rom.mimeType, rom.createdAt) as UploadedRom; }
  async listRomFilenames() { return (sqlite.prepare("SELECT file_name FROM uploaded_roms").all() as any[]).map(r => r.file_name); }
  async listActivityLog(limit = 100) { return sqlite.prepare("SELECT * FROM activity_log ORDER BY ts DESC LIMIT ?").all(limit) as any[]; }
  async addActivityLogEntry(entry: any) { return sqlite.prepare("INSERT INTO activity_log (ts, label, endpoint, status, detail) VALUES (?,?,?,?,?) RETURNING *").get(entry.ts, entry.label, entry.endpoint, entry.status, entry.detail ?? null) as any; }
  async clearActivityLog() { sqlite.exec("DELETE FROM activity_log"); }
}

export const storage = new DatabaseStorage();
