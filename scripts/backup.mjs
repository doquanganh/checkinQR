// Online SQLite backup (safe while the app is running). Run inside the container:
//   docker compose exec -T app node scripts/backup.mjs
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DB_PATH || './data/checkin.db';
const dir = path.join(path.dirname(dbPath), 'backups');
const keep = parseInt(process.env.BACKUP_KEEP || '14', 10);

fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const target = path.join(dir, `checkin-${stamp}.db`);

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
await db.backup(target);
db.close();
console.log(`Backup written: ${target}`);

// keep only the newest N backups
const old = fs.readdirSync(dir).filter((f) => /^checkin-.*\.db$/.test(f)).sort().slice(0, -keep);
for (const f of old) fs.unlinkSync(path.join(dir, f));
