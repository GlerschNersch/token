import { appSettings, collectionItems, gameCollections, romSaveSlots, uploadedRoms, users } from '@shared/schema';
import type {
  GameCollection,
  GameCollectionWithItems,
  InsertGameCollection,
  InsertRomSaveSlot,
  InsertUploadedRom,
  IntegrationSettings,
  RomSaveSlot,
  UploadedRom,
  User,
  InsertUser,
} from '@shared/schema';
import { DEFAULT_INTEGRATION_SETTINGS, integrationSettingsSchema } from '@shared/schema';
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { and, desc, eq } from "drizzle-orm";
import { dataPath, ensureDir, getDataDir } from "./data-dir";

ensureDir(getDataDir());
const sqlite = new Database(dataPath("data.db"));
sqlite.pragma("journal_mode = WAL");
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
  // Per-user save state isolation
  "ALTER TABLE rom_save_slots ADD COLUMN user_id TEXT NOT NULL DEFAULT \'default\'",
  "CREATE UNIQUE INDEX IF NOT EXISTS rom_save_slots_user_idx ON rom_save_slots (rom_id, user_id, slot)",
  "CREATE TABLE IF NOT EXISTS play_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, rom_id INTEGER NOT NULL, rom_title TEXT NOT NULL, rom_system TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, duration_seconds INTEGER)",
]) {
  try {
    sqlite.exec(statement);
  } catch {
    // Column already exists in previously-created prototype databases.
  }
}

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
    meta: Partial<Pick<InsertUploadedRom, "description" | "releaseYear" | "developer" | "publisher" | "genre" | "players" | "artUrl" | "scrapeStatus" | "scrapeMessage" | "communityScore" | "wheelArtUrl">>,
  ): Promise<UploadedRom | undefined>;
  listCollections(): Promise<GameCollectionWithItems[]>;
  createCollection(collection: InsertGameCollection): Promise<GameCollection>;
  deleteCollection(id: number): Promise<boolean>;
  addRomToCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined>;
  removeRomFromCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined>;
  listRomSaveSlots(romId: number, userId: string): Promise<RomSaveSlot[]>;
  upsertRomSaveSlot(saveSlot: InsertRomSaveSlot): Promise<RomSaveSlot>;
  deleteRomSaveSlot(romId: number, slot: number, userId: string): Promise<boolean>;
  getIntegrationSettings(): Promise<IntegrationSettings>;
  saveIntegrationSettings(settings: IntegrationSettings): Promise<IntegrationSettings>;
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
    meta: Partial<Pick<InsertUploadedRom, "description" | "releaseYear" | "developer" | "publisher" | "genre" | "players" | "artUrl" | "scrapeStatus" | "scrapeMessage" | "communityScore" | "wheelArtUrl">>,
  ): Promise<UploadedRom | undefined> {
    return db
      .update(uploadedRoms)
      .set(meta)
      .where(eq(uploadedRoms.id, id))
      .returning()
      .get();
  }

  async deleteUploadedRom(id: number): Promise<UploadedRom | undefined> {
    const rom = await this.getUploadedRom(id);
    if (!rom) return undefined;

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
}

export const storage = new DatabaseStorage();
