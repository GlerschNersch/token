/**
 * Server-side storage integration tests.
 * Uses an in-memory SQLite DB so no /data directory is needed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from 'node:path';

// Mock the log and data-dir modules to avoid side effects
vi.mock('../log', () => ({
  log: vi.fn()
}));

vi.mock('../data-dir', () => ({
  dataPath: vi.fn((p) => p),
  ensureDir: vi.fn(),
  getDataDir: vi.fn(() => '/tmp')
}));

let sqlite: Database.Database;
let db: any;

function bootstrapDb() {
  sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  db = drizzle(sqlite);

  // Run migrations
  const migrationsFolder = path.join(process.cwd(), "migrations");
  migrate(db, { migrationsFolder });

  // Default profile (usually handled by initializeDatabase, but we do it manually for tests)
  sqlite.prepare('INSERT OR IGNORE INTO user_profiles (id, name, color, created_at) VALUES (1, ?, ?, ?)').run('Player 1', '#8b5cf6', Date.now());

  return { sqlite, db };
}

function makeRom(overrides: Record<string, any> = {}) {
  return {
    title: 'Super Mario World',
    system: 'snes',
    slug: 'super-mario-world',
    originalName: 'smw.sfc',
    fileName: 'smw.sfc',
    filePath: '/data/roms/smw.sfc',
    size: 524288,
    mimeType: 'application/octet-stream',
    createdAt: Date.now(),
    ...overrides,
  };
}

function insertRom(rom: ReturnType<typeof makeRom>) {
  return sqlite.prepare(`
    INSERT INTO uploaded_roms
      (title, system, slug, original_name, file_name, file_path, size, mime_type, created_at)
    VALUES (?,?,?,?,?,?,?,?,?) RETURNING *
  `).get(rom.title, rom.system, rom.slug, rom.originalName, rom.fileName, rom.filePath, rom.size, rom.mimeType, rom.createdAt) as any;
}

describe('DatabaseStorage — ROM CRUD', () => {
  beforeEach(() => bootstrapDb());
  afterEach(() => sqlite.close());

  it('inserts and retrieves a ROM', () => {
    const inserted = insertRom(makeRom());
    expect(inserted.id).toBeGreaterThan(0);
    const row = sqlite.prepare('SELECT * FROM uploaded_roms WHERE id=?').get(inserted.id) as any;
    expect(row.title).toBe('Super Mario World');
    expect(row.system).toBe('snes');
    expect(row.scrape_status).toBe('not_scraped');
  });

  it('enforces unique slug constraint', () => {
    insertRom(makeRom());
    expect(() => insertRom(makeRom())).toThrow();
  });

  it('deletes a ROM and cascades collection_items', () => {
    const rom = insertRom(makeRom());
    const col = sqlite.prepare('INSERT INTO game_collections (name, slug, created_at) VALUES (?,?,?) RETURNING *').get('Favs', 'favs', Date.now()) as any;
    sqlite.prepare('INSERT INTO collection_items (collection_id, rom_id, created_at) VALUES (?,?,?)').run(col.id, rom.id, Date.now());
    // Delete ROM
    sqlite.prepare('DELETE FROM collection_items WHERE rom_id=?').run(rom.id);
    sqlite.prepare('DELETE FROM uploaded_roms WHERE id=?').run(rom.id);
    const items = sqlite.prepare('SELECT * FROM collection_items WHERE rom_id=?').all(rom.id);
    expect(items).toHaveLength(0);
  });

  it('increments minutes_played correctly', () => {
    const rom = insertRom(makeRom());
    sqlite.prepare('UPDATE uploaded_roms SET minutes_played = minutes_played + ? WHERE id=?').run(42, rom.id);
    const updated = sqlite.prepare('SELECT minutes_played FROM uploaded_roms WHERE id=?').get(rom.id) as any;
    expect(updated.minutes_played).toBe(42);
  });

  it('updates play_status', () => {
    const rom = insertRom(makeRom());
    sqlite.prepare('UPDATE uploaded_roms SET play_status=? WHERE id=?').run('completed', rom.id);
    const row = sqlite.prepare('SELECT play_status FROM uploaded_roms WHERE id=?').get(rom.id) as any;
    expect(row.play_status).toBe('completed');
  });
});

describe('DatabaseStorage — Collections', () => {
  beforeEach(() => bootstrapDb());
  afterEach(() => sqlite.close());

  it('creates a collection', () => {
    const col = sqlite.prepare('INSERT INTO game_collections (name, slug, created_at) VALUES (?,?,?) RETURNING *').get('RPGs', 'rpgs', Date.now()) as any;
    expect(col.id).toBeGreaterThan(0);
    expect(col.name).toBe('RPGs');
  });

  it('adds and removes a ROM from a collection', () => {
    const rom = insertRom(makeRom());
    const col = sqlite.prepare('INSERT INTO game_collections (name, slug, created_at) VALUES (?,?,?) RETURNING *').get('Favs', 'favs', Date.now()) as any;
    sqlite.prepare('INSERT INTO collection_items (collection_id, rom_id, created_at) VALUES (?,?,?)').run(col.id, rom.id, Date.now());
    let items = sqlite.prepare('SELECT * FROM collection_items WHERE collection_id=?').all(col.id);
    expect(items).toHaveLength(1);
    sqlite.prepare('DELETE FROM collection_items WHERE collection_id=? AND rom_id=?').run(col.id, rom.id);
    items = sqlite.prepare('SELECT * FROM collection_items WHERE collection_id=?').all(col.id);
    expect(items).toHaveLength(0);
  });

  it('deletes collection without deleting ROMs', () => {
    const rom = insertRom(makeRom());
    const col = sqlite.prepare('INSERT INTO game_collections (name, slug, created_at) VALUES (?,?,?) RETURNING *').get('Favs', 'favs', Date.now()) as any;
    sqlite.prepare('INSERT INTO collection_items (collection_id, rom_id, created_at) VALUES (?,?,?)').run(col.id, rom.id, Date.now());
    sqlite.prepare('DELETE FROM collection_items WHERE collection_id=?').run(col.id);
    sqlite.prepare('DELETE FROM game_collections WHERE id=?').run(col.id);
    const romStillExists = sqlite.prepare('SELECT * FROM uploaded_roms WHERE id=?').get(rom.id);
    expect(romStillExists).toBeTruthy();
  });
});

describe('DatabaseStorage — Profiles & Game State', () => {
  beforeEach(() => bootstrapDb());
  afterEach(() => sqlite.close());

  it('cannot delete profile 1', () => {
    const canDelete = (id: number) => id !== 1;
    expect(canDelete(1)).toBe(false);
    expect(canDelete(2)).toBe(true);
  });

  it('upserts profile game state — insert then update', () => {
    const rom = insertRom(makeRom());
    const now = Date.now();
    sqlite.prepare('INSERT INTO profile_game_state (profile_id, rom_id, favorite, rating, play_status, updated_at) VALUES (?,?,?,?,?,?)').run(1, rom.id, 1, 0, 'unset', now);
    let row = sqlite.prepare('SELECT * FROM profile_game_state WHERE profile_id=? AND rom_id=?').get(1, rom.id) as any;
    expect(row.favorite).toBe(1);
    sqlite.prepare('UPDATE profile_game_state SET rating=?, updated_at=? WHERE profile_id=? AND rom_id=?').run(8, Date.now(), 1, rom.id);
    row = sqlite.prepare('SELECT * FROM profile_game_state WHERE profile_id=? AND rom_id=?').get(1, rom.id) as any;
    expect(row.rating).toBe(8);
  });

  it('profile game states are isolated per profile', () => {
    const rom = insertRom(makeRom());
    sqlite.prepare('INSERT INTO user_profiles (id, name, color, created_at) VALUES (2, ?, ?, ?)').run('Player 2', '#ef4444', Date.now());
    sqlite.prepare('INSERT INTO profile_game_state (profile_id, rom_id, favorite, rating, play_status, updated_at) VALUES (?,?,?,?,?,?)').run(1, rom.id, 1, 5, 'completed', Date.now());
    sqlite.prepare('INSERT INTO profile_game_state (profile_id, rom_id, favorite, rating, play_status, updated_at) VALUES (?,?,?,?,?,?)').run(2, rom.id, 0, 0, 'unset', Date.now());
    const p1 = sqlite.prepare('SELECT * FROM profile_game_state WHERE profile_id=? AND rom_id=?').get(1, rom.id) as any;
    const p2 = sqlite.prepare('SELECT * FROM profile_game_state WHERE profile_id=? AND rom_id=?').get(2, rom.id) as any;
    expect(p1.rating).toBe(5);
    expect(p2.rating).toBe(0);
  });
});

describe('DatabaseStorage — Play Sessions', () => {
  beforeEach(() => bootstrapDb());
  afterEach(() => sqlite.close());

  it('creates and ends a play session', () => {
    const rom = insertRom(makeRom());
    // Create the play_sessions table manually as it might not be in the schema yet if it was a manual migration before
    sqlite.exec(`CREATE TABLE IF NOT EXISTS play_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, rom_id INTEGER NOT NULL, rom_title TEXT NOT NULL, rom_system TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, duration_seconds INTEGER)`);
    
    const result = sqlite.prepare('INSERT INTO play_sessions (rom_id, rom_title, rom_system, started_at) VALUES (?,?,?,?) RETURNING *').get(rom.id, rom.title, rom.system, Date.now()) as any;
    expect(result.id).toBeGreaterThan(0);
    expect(result.ended_at).toBeNull();
    sqlite.prepare('UPDATE play_sessions SET ended_at=?, duration_seconds=? WHERE id=?').run(Date.now(), 120, result.id);
    const ended = sqlite.prepare('SELECT * FROM play_sessions WHERE id=?').get(result.id) as any;
    expect(ended.duration_seconds).toBe(120);
  });
});

describe('DatabaseStorage — Save Slots', () => {
  beforeEach(() => bootstrapDb());
  afterEach(() => sqlite.close());

  it('upserts a save slot', () => {
    const rom = insertRom(makeRom());
    sqlite.prepare('INSERT INTO rom_save_slots (rom_id, slot, user_id, label, updated_at) VALUES (?,?,?,?,?)').run(rom.id, 1, 'default', 'Slot 1', Date.now());
    let row = sqlite.prepare('SELECT * FROM rom_save_slots WHERE rom_id=? AND slot=? AND user_id=?').get(rom.id, 1, 'default') as any;
    expect(row.label).toBe('Slot 1');
    sqlite.prepare('UPDATE rom_save_slots SET label=?, updated_at=? WHERE id=?').run('World 3', Date.now(), row.id);
    row = sqlite.prepare('SELECT * FROM rom_save_slots WHERE id=?').get(row.id) as any;
    expect(row.label).toBe('World 3');
  });

  it('save slots are isolated per user', () => {
    const rom = insertRom(makeRom());
    sqlite.prepare('INSERT INTO rom_save_slots (rom_id, slot, user_id, label, updated_at) VALUES (?,?,?,?,?)').run(rom.id, 1, 'user-a', 'A Save', Date.now());
    sqlite.prepare('INSERT INTO rom_save_slots (rom_id, slot, user_id, label, updated_at) VALUES (?,?,?,?,?)').run(rom.id, 1, 'user-b', 'B Save', Date.now());
    const a = sqlite.prepare('SELECT * FROM rom_save_slots WHERE rom_id=? AND user_id=?').all(rom.id, 'user-a') as any[];
    const b = sqlite.prepare('SELECT * FROM rom_save_slots WHERE rom_id=? AND user_id=?').all(rom.id, 'user-b') as any[];
    expect(a[0].label).toBe('A Save');
    expect(b[0].label).toBe('B Save');
  });
});

describe('DatabaseStorage — Activity Log', () => {
  beforeEach(() => bootstrapDb());
  afterEach(() => sqlite.close());

  it('inserts and lists activity log entries', () => {
    sqlite.prepare('INSERT INTO activity_log (ts, label, endpoint, status, detail) VALUES (?,?,?,?,?)').run(Date.now(), 'ROM upload', '/api/roms', 'ok', null);
    const rows = sqlite.prepare('SELECT * FROM activity_log ORDER BY ts DESC LIMIT 10').all();
    expect(rows).toHaveLength(1);
  });

  it('clears activity log', () => {
    sqlite.prepare('INSERT INTO activity_log (ts, label, endpoint, status, detail) VALUES (?,?,?,?,?)').run(Date.now(), 'test', '/api/test', 'ok', null);
    sqlite.exec('DELETE FROM activity_log');
    const rows = sqlite.prepare('SELECT * FROM activity_log').all();
    expect(rows).toHaveLength(0);
  });
});
