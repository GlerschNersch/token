import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const uploadedRoms = sqliteTable("uploaded_roms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  system: text("system").notNull(),
  slug: text("slug").notNull().unique(),
  originalName: text("original_name").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type").notNull(),
  artUrl: text("art_url"),
  scrapeStatus: text("scrape_status").notNull().default("not_scraped"),
  scrapeMessage: text("scrape_message"),
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(true),
  rating: integer("rating").notNull().default(0),
  lastPlayed: integer("last_played").notNull().default(0),
  playCount: integer("play_count").notNull().default(0),
  discNumber: integer("disc_number"),
  discGroup: text("disc_group"),
  // Rich metadata from ScreenScraper or other sources
  description: text("description"),
  releaseYear: integer("release_year"),
  developer: text("developer"),
  publisher: text("publisher"),
  genre: text("genre"),
  players: text("players"),
  romHash: text("rom_hash"),
  minutesPlayed: integer("minutes_played").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const insertUploadedRomSchema = createInsertSchema(uploadedRoms).omit({
  id: true,
});

export type InsertUploadedRom = z.infer<typeof insertUploadedRomSchema>;
export type UploadedRom = typeof uploadedRoms.$inferSelect;

export const gameCollections = sqliteTable("game_collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const collectionItems = sqliteTable("collection_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  collectionId: integer("collection_id").notNull(),
  romId: integer("rom_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const romSaveSlots = sqliteTable("rom_save_slots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  romId: integer("rom_id").notNull(),
  slot: integer("slot").notNull(),
  label: text("label").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const insertGameCollectionSchema = createInsertSchema(gameCollections).omit({
  id: true,
});

export const insertCollectionItemSchema = createInsertSchema(collectionItems).omit({
  id: true,
});

export const insertRomSaveSlotSchema = createInsertSchema(romSaveSlots).omit({
  id: true,
});

export type InsertGameCollection = z.infer<typeof insertGameCollectionSchema>;
export type GameCollection = typeof gameCollections.$inferSelect;
export type InsertCollectionItem = z.infer<typeof insertCollectionItemSchema>;
export type CollectionItem = typeof collectionItems.$inferSelect;
export type InsertRomSaveSlot = z.infer<typeof insertRomSaveSlotSchema>;
export type RomSaveSlot = typeof romSaveSlots.$inferSelect;

export type GameCollectionWithItems = GameCollection & {
  romIds: number[];
};

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;

export const integrationSettingsSchema = z.object({
  haBaseUrl: z.string().max(2048).default("https://homeassistant.local:8123"),
  haToken: z.string().max(4096).default(""),
  liveMode: z.boolean().default(false),
  endpoints: z.record(z.string(), z.string().max(2048)).default({}),
  ssUserId: z.string().max(256).default(""),
  ssPassword: z.string().max(256).default(""),
  kioskMode: z.boolean().default(false),
  kioskPin: z.string().max(8).default(""),
  kioskCollectionId: z.number().int().nullable().default(null),
  raUsername: z.string().max(256).default(""),
  raToken: z.string().max(256).default(""),
});

export type IntegrationSettings = z.infer<typeof integrationSettingsSchema>;

export const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  haBaseUrl: "https://homeassistant.local:8123",
  haToken: "",
  liveMode: false,
  endpoints: {},
  ssUserId: "",
  ssPassword: "",
  kioskMode: false,
  kioskPin: "",
  kioskCollectionId: null,
  raUsername: "",
  raToken: "",
};
