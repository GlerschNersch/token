import { collectionItems, gameCollections, romSaveSlots, uploadedRoms, users } from '@shared/schema';
import type {
  GameCollection,
  GameCollectionWithItems,
  InsertGameCollection,
  InsertRomSaveSlot,
  InsertUploadedRom,
  RomSaveSlot,
  UploadedRom,
  User,
  InsertUser,
} from '@shared/schema';
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
`);
for (const statement of [
  "ALTER TABLE uploaded_roms ADD COLUMN art_url TEXT",
  "ALTER TABLE uploaded_roms ADD COLUMN scrape_status TEXT NOT NULL DEFAULT 'not_scraped'",
  "ALTER TABLE uploaded_roms ADD COLUMN scrape_message TEXT",
  "ALTER TABLE uploaded_roms ADD COLUMN rating INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE uploaded_roms ADD COLUMN last_played INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE uploaded_roms ADD COLUMN play_count INTEGER NOT NULL DEFAULT 0",
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
  listCollections(): Promise<GameCollectionWithItems[]>;
  createCollection(collection: InsertGameCollection): Promise<GameCollection>;
  deleteCollection(id: number): Promise<boolean>;
  addRomToCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined>;
  removeRomFromCollection(collectionId: number, romId: number): Promise<GameCollectionWithItems | undefined>;
  listRomSaveSlots(romId: number): Promise<RomSaveSlot[]>;
  upsertRomSaveSlot(saveSlot: InsertRomSaveSlot): Promise<RomSaveSlot>;
  deleteRomSaveSlot(romId: number, slot: number): Promise<boolean>;
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

  async createUploadedRom(rom: InsertUploadedRom): Promise<UploadedRom> {
    return db.insert(uploadedRoms).values(rom).returning().get();
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

  async listRomSaveSlots(romId: number): Promise<RomSaveSlot[]> {
    return db
      .select()
      .from(romSaveSlots)
      .where(eq(romSaveSlots.romId, romId))
      .orderBy(romSaveSlots.slot)
      .all();
  }

  async upsertRomSaveSlot(saveSlot: InsertRomSaveSlot): Promise<RomSaveSlot> {
    const existing = db
      .select()
      .from(romSaveSlots)
      .where(and(eq(romSaveSlots.romId, saveSlot.romId), eq(romSaveSlots.slot, saveSlot.slot)))
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

  async deleteRomSaveSlot(romId: number, slot: number): Promise<boolean> {
    const result = db
      .delete(romSaveSlots)
      .where(and(eq(romSaveSlots.romId, romId), eq(romSaveSlots.slot, slot)))
      .run();
    return result.changes > 0;
  }
}

export const storage = new DatabaseStorage();
