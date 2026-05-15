
import Database from 'better-sqlite3';
const db = new Database('data.db');
console.log('Tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
const roms = db.prepare('SELECT * FROM uploaded_roms').all();
console.log('ROMs count:', roms.length);
if (roms.length > 0) {
    console.log('First 5 ROMs:', JSON.stringify(roms.slice(0, 5), null, 2));
}
