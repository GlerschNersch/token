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
  smartFilter: text("smart_filter"),
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
  romHash: text("rom_hash"),
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

export type SmartFilterRules = {
  systems?: string[];
  playStatus?: string[];
  minRating?: number;
  minMinutesPlayed?: number;
  favorites?: boolean;
  genre?: string;
};

export type GameCollectionWithItems = GameCollection & {
  romIds: number[];
  smartFilter?: SmartFilterRules;
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
  pcHostname: z.string().max(256).default("ARCADE-PC"),
  pcOnlineEntityId: z.string().max(256).default(""),
  pcCpuEntityId: z.string().max(256).default(""),
  pcRamEntityId: z.string().max(256).default(""),
  pcAppEntityId: z.string().max(256).default(""),
  controlDefaults: z.record(z.string(), z.record(z.coerce.number(), z.string().max(64))).default({}),
  gamepadRumble: z.boolean().default(true),
  language: z.string().max(10).default("en"),
  theme: z.string().max(32).default("default"),
  dashboardTheme: z.string().max(32).default("nostalgia"),
  globalAspectRatio: z.string().max(16).default("auto"),
  globalShader: z.string().max(64).default("none"),
  showSystemLabels: z.boolean().default(true),
  systemDisplay: z.record(z.string(), z.object({
    aspectRatio: z.string().max(16).optional(),
    integerScale: z.boolean().optional(),
    shader: z.string().max(64).optional(),
  })).default({}),
  uiGamepadMapping: z.record(z.string(), z.union([
    z.number().int(),
    z.object({ kind: z.enum(["button", "axis"]), buttonIndex: z.number().int().optional(), axisIndex: z.number().int().optional(), direction: z.number().int().optional() }),
  ])).default({
    select:   { kind: "button", buttonIndex: 0 },
    back:     { kind: "button", buttonIndex: 1 },
    favorite: { kind: "button", buttonIndex: 3 },
    menu:     { kind: "button", buttonIndex: 9 },
  }),
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
  gamepadRumble: true,
  language: "en",
  theme: "default",
  dashboardTheme: "nostalgia",
  globalAspectRatio: "auto",
  globalShader: "none",
  showSystemLabels: true,
  systemDisplay: {},
  uiGamepadMapping: {
    select: 0,   // A
    back: 1,     // B
    favorite: 3, // Y
    menu: 9,     // Start
  },
};

export const userProfiles = sqliteTable("user_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8b5cf6"),
  createdAt: integer("created_at").notNull(),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

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

export const profileControlBindings = sqliteTable("profile_control_bindings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull(),
  core: text("core").notNull(),
  bindings: text("bindings").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type ProfileControlBinding = typeof profileControlBindings.$inferSelect;

export const gamepadBindings = sqliteTable("gamepad_bindings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull().default(1),
  gamepadId: text("gamepad_id").notNull().default("default"),
  romId: integer("rom_id"),
  bindings: text("bindings").notNull().default("{}"),
  updatedAt: integer("updated_at").notNull(),
});

export type GamepadBinding = typeof gamepadBindings.$inferSelect;

export const gamepadBindingsSchema = z.object({
  profileId: z.number().int().default(1),
  gamepadId: z.string().default("default"),
  romId: z.number().int().nullable(),
  bindings: z.record(z.string(), z.union([
    z.number().int(),
    z.object({ kind: z.enum(["button", "axis"]), buttonIndex: z.number().int().optional(), axisIndex: z.number().int().optional(), direction: z.number().int().optional() }),
  ])).default({}),
});

export const cheatIndexCache = sqliteTable("cheat_index_cache", {
  id:        integer("id").primaryKey({ autoIncrement: true }),
  folder:    text("folder").notNull().unique(),
  filesJson: text("files_json").notNull(),
  cachedAt:  integer("cached_at").notNull(),
});

export const cheatFileCache = sqliteTable("cheat_file_cache", {
  id:        integer("id").primaryKey({ autoIncrement: true }),
  path:      text("path").notNull().unique(),
  cheatsJson: text("cheats_json").notNull(),
  cachedAt:  integer("cached_at").notNull(),
});

export const hltbCache = sqliteTable("hltb_cache", {
  id:             integer("id").primaryKey({ autoIncrement: true }),
  romId:          integer("rom_id").notNull().unique(),
  hltbTitle:      text("hltb_title"),
  mainStory:      integer("main_story"),
  mainExtra:      integer("main_extra"),
  completionist:  integer("completionist"),
  cachedAt:       integer("cached_at").notNull(),
});

export type HltbCache = typeof hltbCache.$inferSelect;

// ── Mounted Library Source ────────────────────────────────────────────────────

export const platformFolderMappingSchema = z.object({
  platformId: z.string(),
  folderName: z.string(),
  fullPath: z.string(),
  enabled: z.boolean().default(true),
  detected: z.boolean().default(true),
  gameCount: z.number().optional(),
});

export const librarySourceSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  sourceType: z.literal("mounted_path").default("mounted_path"),
  rootPath: z.string().default(""),
  autoDetectPlatforms: z.boolean().default(true),
  folderMappings: z.array(platformFolderMappingSchema).default([]),
  lastScanAt: z.string().optional(),
  lastScanStatus: z.enum(["idle", "scanning", "success", "error"]).optional(),
  lastError: z.string().optional(),
});

export const detectedPlatformSchema = z.object({
  platformId: z.string(),
  platformName: z.string(),
  folderName: z.string(),
  fullPath: z.string(),
  gameCount: z.number(),
  sampleGames: z.array(z.string()).default([]),
  detectionMethod: z.enum(["exact", "alias", "manual"]).default("exact"),
});

export const unmatchedFolderSchema = z.object({
  folderName: z.string(),
  fullPath: z.string(),
  fileCount: z.number(),
  sampleFiles: z.array(z.string()).default([]),
});

export const scanLibraryRequestSchema = z.object({
  rootPath: z.string().min(1),
  autoDetectPlatforms: z.boolean().default(true),
});

export const scanLibraryResponseSchema = z.object({
  rootPath: z.string(),
  scannedAt: z.string(),
  platforms: z.array(detectedPlatformSchema).default([]),
  unmatchedFolders: z.array(unmatchedFolderSchema).default([]),
  warnings: z.array(z.string()).default([]),
});

export type PlatformFolderMapping = z.infer<typeof platformFolderMappingSchema>;
export type LibrarySourceSettings = z.infer<typeof librarySourceSettingsSchema>;
export type DetectedPlatform = z.infer<typeof detectedPlatformSchema>;
export type UnmatchedFolder = z.infer<typeof unmatchedFolderSchema>;
export type ScanLibraryRequest = z.infer<typeof scanLibraryRequestSchema>;
export type ScanLibraryResponse = z.infer<typeof scanLibraryResponseSchema>;

export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ts: integer("ts").notNull(),
  label: text("label").notNull(),
  endpoint: text("endpoint").notNull(),
  status: text("status").notNull(),
  detail: text("detail"),
});

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({ id: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLogEntry = typeof activityLog.$inferSelect;

export const playSessions = sqliteTable("play_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  romId: integer("rom_id").notNull(),
  romTitle: text("rom_title").notNull(),
  romSystem: text("rom_system").notNull(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  durationSeconds: integer("duration_seconds"),
});

export const insertPlaySessionSchema = createInsertSchema(playSessions).omit({ id: true });
export type InsertPlaySession = z.infer<typeof insertPlaySessionSchema>;
export type PlaySession = typeof playSessions.$inferSelect;
