
import Database from 'better-sqlite3';
const db = new Database('data.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
for (const t of tables) {
    try {
        const count = db.prepare(`SELECT count(*) as c FROM ${t.name}`).get().c;
        if (count > 0) {
            console.log(`Table ${t.name}: ${count} rows`);
            const rows = db.prepare(`SELECT * FROM ${t.name} LIMIT 5`).all();
            console.log(JSON.stringify(rows, null, 2));
        }
    } catch (e) {
        console.log(`Error reading table ${t.name}:`, e.message);
    }
}
