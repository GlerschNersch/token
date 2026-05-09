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
  communityScore: integer("community_score"),
  wheelArtUrl: text("wheel_art_url"),
  videoUrl: text("video_url"),
  raGameId: integer("ra_game_id"),
  minutesPlayed: integer("minutes_played").notNull().default(0),
  playStatus: text("play_status").notNull().default("unset"),
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
  userId: text("user_id").notNull().default("default"),
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
  tgdbApiKey: z.string().max(256).default(""),
  // PC status panel — HA entity IDs to poll for live stats
  pcHostname: z.string().max(256).default("ARCADE-PC"),
  pcOnlineEntityId: z.string().max(256).default(""),
  pcCpuEntityId: z.string().max(256).default(""),
  pcRamEntityId: z.string().max(256).default(""),
  pcAppEntityId: z.string().max(256).default(""),
  /** Per-core default key bindings: { [core]: { [buttonIndex]: keyName } } */
  controlDefaults: z.record(z.string(), z.record(z.coerce.number(), z.string().max(64))).default({}),
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
  tgdbApiKey: "",
  pcHostname: "ARCADE-PC",
  pcOnlineEntityId: "",
  pcCpuEntityId: "",
  pcRamEntityId: "",
  pcAppEntityId: "",
  controlDefaults: {},
};

// ── User profiles (named, no passwords) ─────────────────────────────────────
export const userProfiles = sqliteTable("user_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8b5cf6"),
  createdAt: integer("created_at").notNull(),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

// ── Per-game cheat codes ─────────────────────────────────────────────────────
export const gameCheatCodes = sqliteTable("game_cheat_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  romId: integer("rom_id").notNull(),
  profileId: integer("profile_id").notNull().default(1),
  description: text("description").notNull(),
  code: text("code").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});

export const insertGameCheatCodeSchema = createInsertSchema(gameCheatCodes).omit({ id: true });
export type InsertGameCheatCode = z.infer<typeof insertGameCheatCodeSchema>;
export type GameCheatCode = typeof gameCheatCodes.$inferSelect;

// ── Per-profile game state (favorites, ratings, play status) ─────────────────
export const profileGameState = sqliteTable("profile_game_state", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull(),
  romId: integer("rom_id").notNull(),
  favorite: integer("favorite", { mode: "boolean" }),
  rating: integer("rating"),
  playStatus: text("play_status"),
  updatedAt: integer("updated_at").notNull(),
});

export const insertProfileGameStateSchema = createInsertSchema(profileGameState).omit({ id: true });
export type InsertProfileGameState = z.infer<typeof insertProfileGameStateSchema>;
export type ProfileGameState = typeof profileGameState.$inferSelect;

// ── Per-profile key bindings ─────────────────────────────────────────────────
export const profileControlBindings = sqliteTable("profile_control_bindings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull(),
  core: text("core").notNull(),
  bindings: text("bindings").notNull(), // JSON: { [buttonIndex]: keyName }
  updatedAt: integer("updated_at").notNull(),
});

export type ProfileControlBinding = typeof profileControlBindings.$inferSelect;

// ── Per-profile gamepad button bindings ──────────────────────────────────────
// bindings JSON: { [retropadButtonId]: gamepadButtonIndex }
// gamepadId: navigator.getGamepads()[n].id string (or "default" for catch-all)
export const gamepadBindings = sqliteTable("gamepad_bindings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull().default(1),
  gamepadId: text("gamepad_id").notNull().default("default"),
  bindings: text("bindings").notNull().default("{}"),
  updatedAt: integer("updated_at").notNull(),
});

export type GamepadBinding = typeof gamepadBindings.$inferSelect;
