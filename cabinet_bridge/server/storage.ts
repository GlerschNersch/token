import { 
  appSettings, collectionItems, gameCollections, hltbCache, romSaveSlots, 
  uploadedRoms, users, userProfiles, gameCheatCodes, profileGameState, 
  profileControlBindings, gamepadBindings, cheatIndexCache, cheatFileCache, 
  activityLog, playSessions
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
  UserProfile,
} from '@shared/schema';
import { DEFAULT_INTEGRATION_SETTINGS, integrationSettingsSchema } from '@shared/schema';
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { and, desc, eq } from "drizzle-orm";
import { dataPath, ensureDir, getDataDir } from "./data-dir";
import { log } from "./log";
import path from "node:path";
import { fileURLToPath } from "node:url";

export let sqlite: Database.Database;
export let db: any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function initializeDatabase() {
  if (sqlite) return;

  try {
    const dataDir = getDataDir();
    ensureDir(dataDir);
    const dbPath = dataPath("data.db");
    
    log(`Connecting to SQLite at ${dbPath}`, "db");
    sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    
    db = drizzle(sqlite);

    // Run migrations
    log("Running migrations...", "db");
    // Bundle-safe migration path: dist/index.cjs is one level down from root (dist/)
    // so we go up one level and then into migrations/
    const migrationsFolder = path.join(__dirname, "..", "migrations");
    try {
      migrate(db, { migrationsFolder });
      log("Migrations complete", "db");
    } catch (migErr: any) {
      log(`Migration error: ${migErr.message}`, "db");
      // Fallback to process.cwd() just in case
      try {
        const fallbackPath = path.join(process.cwd(), "migrations");
        if (fallbackPath !== migrationsFolder) {
          migrate(db, { migrationsFolder: fallbackPath });
          log("Migrations complete (fallback)", "db");
        }
      } catch {}
    }

    // Default Profile
    try {
      const exists = db.select().from(userProfiles).where(eq(userProfiles.id, 1)).get();
      if (!exists) {
        db.insert(userProfiles).values({ id: 1, name: 'Player 1', color: '#8b5cf6', createdAt: Date.now() }).run();
        log("Default profile created", "db");
      }
    } catch (err: any) {
      log(`Failed to create default profile: ${err.message}`, "db");
    }

    log("Database ready", "db");
  } catch (err) {
    log("CRITICAL: Database failure!", "db");
    throw err;
  }
}

// Auto-initialize on import
initializeDatabase();

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
  relinkSaveSlotsByHash(romId: number, romHash: string): Promise<void>;
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

const INTEGRATION_SETTINGS_KEY = "integration";

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> { return db.select().from(users).where(eq(users.id, id)).get(); }
  async getUserByUsername(username: string): Promise<User | undefined> { return db.select().from(users).where(eq(users.username, username)).get(); }
  async createUser(insertUser: InsertUser): Promise<User> { return db.insert(users).values(insertUser).returning().get(); }
  async listUploadedRoms(): Promise<UploadedRom[]> { return db.select().from(uploadedRoms).orderBy(desc(uploadedRoms.createdAt)).all(); }
  async getUploadedRom(id: number): Promise<UploadedRom | undefined> { return db.select().from(uploadedRoms).where(eq(uploadedRoms.id, id)).get(); }
  async listRomsByDiscGroup(discGroup: string): Promise<UploadedRom[]> { return db.select().from(uploadedRoms).where(eq(uploadedRoms.discGroup, discGroup)).orderBy(uploadedRoms.discNumber).all(); }
  async createUploadedRom(rom: InsertUploadedRom): Promise<UploadedRom> { return db.insert(uploadedRoms).values(rom).returning().get(); }
  async incrementRomMinutesPlayed(id: number, minutes: number): Promise<UploadedRom | undefined> {
    const rom = await this.getUploadedRom(id);
    if (!rom) return undefined;
    return db.update(uploadedRoms).set({ minutesPlayed: (rom.minutesPlayed ?? 0) + Math.max(0, Math.round(minutes)) }).where(eq(uploadedRoms.id, id)).returning().get();
  }
  async updateUploadedRomMetadata(id: number, meta: any): Promise<UploadedRom | undefined> { return db.update(uploadedRoms).set(meta).where(eq(uploadedRoms.id, id)).returning().get(); }
  async deleteUploadedRom(id: number): Promise<UploadedRom | undefined> {
    const rom = await this.getUploadedRom(id);
    if (!rom) return undefined;
    db.delete(collectionItems).where(eq(collectionItems.romId, id)).run();
    db.delete(romSaveSlots).where(eq(romSaveSlots.romId, id)).run();
    db.delete(uploadedRoms).where(eq(uploadedRoms.id, id)).run();
    return rom;
  }
  async updateUploadedRomArt(id: number, art: any): Promise<UploadedRom | undefined> { return db.update(uploadedRoms).set(art).where(eq(uploadedRoms.id, id)).returning().get(); }
  async updateUploadedRomPlayStatus(id: number, status: string): Promise<UploadedRom | undefined> { return db.update(uploadedRoms).set({ playStatus: status }).where(eq(uploadedRoms.id, id)).returning().get(); }
  async updateUploadedRomRating(id: number, rating: number): Promise<UploadedRom | undefined> { return db.update(uploadedRoms).set({ rating }).where(eq(uploadedRoms.id, id)).returning().get(); }
  async updateUploadedRomFavorite(id: number, favorite: boolean): Promise<UploadedRom | undefined> { return db.update(uploadedRoms).set({ favorite: favorite ? 1 : 0 }).where(eq(uploadedRoms.id, id)).returning().get(); }
  async markUploadedRomPlayed(id: number): Promise<UploadedRom | undefined> {
    const rom = await this.getUploadedRom(id);
    if (!rom) return undefined;
    return db.update(uploadedRoms).set({ lastPlayed: Date.now(), playCount: (rom.playCount ?? 0) + 1 }).where(eq(uploadedRoms.id, id)).returning().get();
  }
  async listCollections(): Promise<GameCollectionWithItems[]> {
    const collections_ = db.select().from(gameCollections).orderBy(desc(gameCollections.createdAt)).all();
    const items = db.select().from(collectionItems).all();
    return collections_.map((collection: any) => ({
      ...collection,
      smartFilter: collection.smartFilter ? JSON.parse(collection.smartFilter) : undefined,
      romIds: items.filter((item: any) => item.collectionId === collection.id).map((item: any) => item.romId),
    }));
  }
  async createCollection(collection: InsertGameCollection): Promise<GameCollection> { return db.insert(gameCollections).values(collection).returning().get(); }
  async deleteCollection(id: number): Promise<boolean> {
    db.delete(collectionItems).where(eq(collectionItems.collectionId, id)).run();
    const result = db.delete(gameCollections).where(eq(gameCollections.id, id)).run();
    return result.changes > 0;
  }
  async renameCollection(id: number, name: string): Promise<GameCollection | undefined> { return db.update(gameCollections).set({ name }).where(eq(gameCollections.id, id)).returning().get(); }
  async addRomToCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined> {
    db.insert(collectionItems).values({ collectionId, romId, createdAt: Date.now() }).onConflictDoNothing().run();
    const collections = await this.listCollections();
    return collections.find(c => c.id === collectionId);
  }
  async removeRomFromCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined> {
    db.delete(collectionItems).where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.romId, romId))).run();
    const collections = await this.listCollections();
    return collections.find(c => c.id === collectionId);
  }
  async listRomSaveSlots(romId: number, userId: string): Promise<RomSaveSlot[]> {
    return db.select().from(romSaveSlots).where(and(eq(romSaveSlots.romId, romId), eq(romSaveSlots.userId, userId))).orderBy(romSaveSlots.slot).all();
  }
  async upsertRomSaveSlot(saveSlot: InsertRomSaveSlot): Promise<RomSaveSlot> {
    const existing = db.select().from(romSaveSlots).where(and(eq(romSaveSlots.romId, saveSlot.romId), eq(romSaveSlots.userId, saveSlot.userId), eq(romSaveSlots.slot, saveSlot.slot))).get();
    const now = Date.now();
    if (existing) {
      db.update(romSaveSlots).set({ 
        label: saveSlot.label, 
        updatedAt: now,
        romHash: saveSlot.romHash || existing.romHash 
      }).where(eq(romSaveSlots.id, existing.id)).run();
      return { ...existing, label: saveSlot.label, updatedAt: now };
    }
    const inserted = db.insert(romSaveSlots).values({ ...saveSlot, updatedAt: now }).returning().get();
    return inserted;
  }
  async deleteRomSaveSlot(romId: number, slot: number, userId: string): Promise<boolean> {
    const result = db.delete(romSaveSlots).where(and(eq(romSaveSlots.romId, romId), eq(romSaveSlots.userId, userId), eq(romSaveSlots.slot, slot))).run();
    return result.changes > 0;
  }
  async relinkSaveSlotsByHash(romId: number, romHash: string): Promise<void> {
    // Find slots that match the hash but belong to a different romId
    const orphaned = db.select().from(romSaveSlots).where(and(eq(romSaveSlots.romHash, romHash), eq(romSaveSlots.romId, romId))).all();
    // If they already point to the new romId, we're done.
    // Actually, we want to find slots where romHash matches but romId is different.
    const toUpdate = db.select().from(romSaveSlots).where(and(eq(romSaveSlots.romHash, romHash), eq(romSaveSlots.romId, romId))).all(); // Wait, logic error in my head.
    
    // Correct logic: find ANY slot with this hash, and update its romId to the new one.
    db.update(romSaveSlots).set({ romId }).where(eq(romSaveSlots.romHash, romHash)).run();
  }
  async getIntegrationSettings(): Promise<IntegrationSettings> {
    const row = db.select().from(appSettings).where(eq(appSettings.key, INTEGRATION_SETTINGS_KEY)).get();
    if (!row) return DEFAULT_INTEGRATION_SETTINGS;
    try {
      const parsed = JSON.parse(row.value);
      return integrationSettingsSchema.parse(parsed);
    } catch {
      return DEFAULT_INTEGRATION_SETTINGS;
    }
  }
  async saveIntegrationSettings(settings: IntegrationSettings): Promise<IntegrationSettings> {
    const validated = integrationSettingsSchema.parse(settings);
    const value = JSON.stringify(validated);
    const existing = db.select().from(appSettings).where(eq(appSettings.key, INTEGRATION_SETTINGS_KEY)).get();
    if (existing) {
      db.update(appSettings).set({ value, updatedAt: Date.now() }).where(eq(appSettings.key, INTEGRATION_SETTINGS_KEY)).run();
    } else {
      db.insert(appSettings).values({ key: INTEGRATION_SETTINGS_KEY, value, updatedAt: Date.now() }).run();
    }
    return validated;
  }
  async listProfiles(): Promise<UserProfile[]> { return db.select().from(userProfiles).all(); }
  async createProfile(name: string, color: string): Promise<UserProfile> { return db.insert(userProfiles).values({ name, color, createdAt: Date.now() }).returning().get(); }
  async deleteProfile(id: number): Promise<boolean> {
    if (id === 1) return false;
    db.delete(gameCheatCodes).where(eq(gameCheatCodes.profileId, id)).run();
    db.delete(profileGameState).where(eq(profileGameState.profileId, id)).run();
    db.delete(profileControlBindings).where(eq(profileControlBindings.profileId, id)).run();
    db.delete(gamepadBindings).where(eq(gamepadBindings.profileId, id)).run();
    const result = db.delete(userProfiles).where(eq(userProfiles.id, id)).run();
    return result.changes > 0;
  }
  async listCheats(romId: number, profileId: number): Promise<any[]> { return db.select().from(gameCheatCodes).where(and(eq(gameCheatCodes.romId, romId), eq(gameCheatCodes.profileId, profileId))).all(); }
  async createCheat(cheat: any): Promise<any> { return db.insert(gameCheatCodes).values({ ...cheat, createdAt: Date.now() }).returning().get(); }
  async updateCheatEnabled(id: number, enabled: boolean): Promise<boolean> {
    const result = db.update(gameCheatCodes).set({ enabled }).where(eq(gameCheatCodes.id, id)).run();
    return result.changes > 0;
  }
  async deleteCheat(id: number): Promise<boolean> {
    const result = db.delete(gameCheatCodes).where(eq(gameCheatCodes.id, id)).run();
    return result.changes > 0;
  }
  async getProfileGameState(profileId: number, romId: number): Promise<any> { return db.select().from(profileGameState).where(and(eq(profileGameState.profileId, profileId), eq(profileGameState.romId, romId))).get(); }
  async upsertProfileGameState(profileId: number, romId: number, patch: any): Promise<any> {
    const existing = await this.getProfileGameState(profileId, romId);
    if (existing) {
      return db.update(profileGameState).set({ ...patch, updatedAt: Date.now() }).where(eq(profileGameState.id, existing.id)).returning().get();
    }
    return db.insert(profileGameState).values({ profileId, romId, ...patch, updatedAt: Date.now() }).returning().get();
  }
  async listProfileGameStates(profileId: number): Promise<any[]> { return db.select().from(profileGameState).where(eq(profileGameState.profileId, profileId)).all(); }
  async getProfileControlBindings(profileId: number, core: string): Promise<any> {
    const row = db.select().from(profileControlBindings).where(and(eq(profileControlBindings.profileId, profileId), eq(profileControlBindings.core, core))).get();
    return row ? JSON.parse(row.bindings) : null;
  }
  async setProfileControlBindings(profileId: number, core: string, bindings: any): Promise<void> {
    const value = JSON.stringify(bindings);
    const existing = db.select().from(profileControlBindings).where(and(eq(profileControlBindings.profileId, profileId), eq(profileControlBindings.core, core))).get();
    if (existing) {
      db.update(profileControlBindings).set({ bindings: value, updatedAt: Date.now() }).where(eq(profileControlBindings.id, existing.id)).run();
    } else {
      db.insert(profileControlBindings).values({ profileId, core, bindings: value, updatedAt: Date.now() }).run();
    }
  }
  async getGamepadBindings(profileId: number, gamepadId: string): Promise<any> {
    const row = db.select().from(gamepadBindings).where(and(eq(gamepadBindings.profileId, profileId), eq(gamepadBindings.gamepadId, gamepadId))).get();
    return row ? JSON.parse(row.bindings) : null;
  }
  async setGamepadBindings(profileId: number, gamepadId: string, bindings: any): Promise<void> {
    const value = JSON.stringify(bindings);
    const existing = db.select().from(gamepadBindings).where(and(eq(gamepadBindings.profileId, profileId), eq(gamepadBindings.gamepadId, gamepadId))).get();
    if (existing) {
      db.update(gamepadBindings).set({ bindings: value, updatedAt: Date.now() }).where(eq(gamepadBindings.id, existing.id)).run();
    } else {
      db.insert(gamepadBindings).values({ profileId, gamepadId, bindings: value, updatedAt: Date.now() }).run();
    }
  }
  async listGamepadBindings(profileId: number): Promise<any[]> { return db.select().from(gamepadBindings).where(eq(gamepadBindings.profileId, profileId)).all(); }
  async getCheatIndex(folder: string): Promise<any> {
    const row = db.select().from(cheatIndexCache).where(eq(cheatIndexCache.folder, folder)).get();
    return row ? JSON.parse(row.filesJson) : null;
  }
  async setCheatIndex(folder: string, files: any[]): Promise<void> {
    const value = JSON.stringify(files);
    const existing = db.select().from(cheatIndexCache).where(eq(cheatIndexCache.folder, folder)).get();
    if (existing) {
      db.update(cheatIndexCache).set({ filesJson: value, cachedAt: Date.now() }).where(eq(cheatIndexCache.folder, folder)).run();
    } else {
      db.insert(cheatIndexCache).values({ folder, filesJson: value, cachedAt: Date.now() }).run();
    }
  }
  async getCachedCheats(path: string): Promise<any> {
    const row = db.select().from(cheatFileCache).where(eq(cheatFileCache.path, path)).get();
    return row ? JSON.parse(row.cheatsJson) : null;
  }
  async setCachedCheats(path: string, cheats: any[]): Promise<void> {
    const value = JSON.stringify(cheats);
    const existing = db.select().from(cheatFileCache).where(eq(cheatFileCache.path, path)).get();
    if (existing) {
      db.update(cheatFileCache).set({ cheatsJson: value, cachedAt: Date.now() }).where(eq(cheatFileCache.path, path)).run();
    } else {
      db.insert(cheatFileCache).values({ path, cheatsJson: value, cachedAt: Date.now() }).run();
    }
  }
  async clearCheatCache(): Promise<void> {
    db.delete(cheatIndexCache).run();
    db.delete(cheatFileCache).run();
  }
  async getHltbCache(romId: number): Promise<any> { return db.select().from(hltbCache).where(eq(hltbCache.romId, romId)).get(); }
  async saveHltbCache(data: any): Promise<void> {
    const existing = await this.getHltbCache(data.romId);
    if (existing) {
      db.update(hltbCache).set({ ...data, cachedAt: Date.now() }).where(eq(hltbCache.id, existing.id)).run();
    } else {
      db.insert(hltbCache).values({ ...data, cachedAt: Date.now() }).run();
    }
  }
  async addScannedRom(rom: any): Promise<UploadedRom> { return db.insert(uploadedRoms).values(rom).returning().get(); }
  async listRomFilenames(): Promise<string[]> {
    const rows = db.select({ fileName: uploadedRoms.fileName }).from(uploadedRoms).all();
    return rows.map((r: any) => r.fileName);
  }
  async listActivityLog(limit = 100): Promise<any[]> { return db.select().from(activityLog).orderBy(desc(activityLog.ts)).limit(limit).all(); }
  async addActivityLogEntry(entry: any): Promise<any> { return db.insert(activityLog).values({ ...entry, ts: Date.now() }).returning().get(); }
  async clearActivityLog(): Promise<void> { db.delete(activityLog).run(); }
  async createPlaySession(romId: number, romTitle: string, romSystem: string, startedAt: number): Promise<number> {
    const result = db.insert(playSessions).values({ romId, romTitle, romSystem, startedAt }).returning().get();
    return result.id;
  }
  async endPlaySession(sessionId: number, endedAt: number, durationSeconds: number): Promise<void> {
    db.update(playSessions).set({ endedAt, durationSeconds }).where(eq(playSessions.id, sessionId)).run();
  }
  async listRecentSessions(limit = 50): Promise<any[]> {
    return db.select().from(playSessions).orderBy(desc(playSessions.startedAt)).limit(limit).all();
  }
}

export const storage = new DatabaseStorage();
