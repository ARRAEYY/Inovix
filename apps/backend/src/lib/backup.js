/**
 * Database backup — creates a backup of the database.
 *
 * For SQLite (dev): copies the .db file to a timestamped backup.
 * For PostgreSQL (prod): runs pg_dump to a compressed .sql.gz file.
 *
 * Backups are stored in the BACKUP_DIR (default: ./backups/).
 * Old backups are purged after BACKUP_RETENTION_DAYS (default: 30).
 *
 * Env:
 *   - BACKUP_DIR (default: ./backups)
 *   - BACKUP_RETENTION_DAYS (default: 30)
 *   - DATABASE_URL (read from process.env — determines backup method)
 *
 * Run via cron (daily at 03:30, after the purge jobs at 03:00).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const prisma = require('./prisma');

function isPostgres() {
  const url = process.env.DATABASE_URL || '';
  return url.startsWith('postgres') || url.startsWith('postgresql');
}

function getBackupDir() {
  const dir = process.env.BACKUP_DIR || path.resolve(__dirname, '../../backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

async function backupDatabase() {
  const backupDir = getBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);

  let backupPath;
  let method;

  if (isPostgres()) {
    // PostgreSQL — use pg_dump
    method = 'pg_dump';
    backupPath = path.join(backupDir, `campus_food_${timestamp}.sql.gz`);

    const dbUrl = process.env.DATABASE_URL;
    try {
      execSync(`pg_dump "${dbUrl}" | gzip > "${backupPath}"`, {
        stdio: 'pipe',
        timeout: 5 * 60 * 1000, // 5 min timeout
      });
    } catch (err) {
      console.error('[backup] pg_dump failed:', err.message);
      throw err;
    }
  } else {
    // SQLite — copy the file
    method = 'file-copy';
    const dbUrl = process.env.DATABASE_URL || '';
    // Extract the file path from "file:./dev.db" or "file:/path/to/dev.db"
    let dbPath = dbUrl.replace(/^file:/, '');
    if (dbPath.startsWith('./')) {
      // Relative path — resolve from the backend root
      dbPath = path.resolve(__dirname, '../../', dbPath);
    }

    if (!fs.existsSync(dbPath)) {
      console.error(`[backup] SQLite file not found: ${dbPath}`);
      return { skipped: true, reason: 'db file not found' };
    }

    backupPath = path.join(backupDir, `campus_food_${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
  }

  const stats = fs.statSync(backupPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`[backup] ${method} → ${path.basename(backupPath)} (${sizeMB} MB)`);

  // Purge old backups
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(backupDir);
  let purged = 0;
  for (const file of files) {
    const filePath = path.join(backupDir, file);
    const fileStat = fs.statSync(filePath);
    if (fileStat.mtime.getTime() < cutoff) {
      fs.unlinkSync(filePath);
      purged++;
    }
  }
  if (purged > 0) {
    console.log(`[backup] purged ${purged} old backups (older than ${retentionDays} days)`);
  }

  return {
    method,
    path: backupPath,
    sizeBytes: stats.size,
    purged,
  };
}

/**
 * Restore a backup — for emergency recovery.
 *
 * For SQLite: copies the backup file back to the DB path.
 * For PostgreSQL: runs `gunzip -c backup.sql.gz | psql DATABASE_URL`.
 *
 * Usage: node -e "require('./src/lib/backup').restoreDatabase('/path/to/backup.db')"
 */
async function restoreDatabase(backupPath) {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  if (isPostgres()) {
    const dbUrl = process.env.DATABASE_URL;
    console.log(`[restore] Restoring PostgreSQL from ${backupPath}...`);
    execSync(`gunzip -c "${backupPath}" | psql "${dbUrl}"`, {
      stdio: 'inherit',
      timeout: 10 * 60 * 1000, // 10 min timeout
    });
    console.log('[restore] PostgreSQL restore complete.');
  } else {
    const dbUrl = process.env.DATABASE_URL || '';
    let dbPath = dbUrl.replace(/^file:/, '');
    if (dbPath.startsWith('./')) {
      dbPath = path.resolve(__dirname, '../../', dbPath);
    }
    console.log(`[restore] Copying ${backupPath} → ${dbPath}...`);
    fs.copyFileSync(backupPath, dbPath);
    console.log('[restore] SQLite restore complete.');
  }

  return { restored: true, path: backupPath };
}

module.exports = {
  backupDatabase,
  restoreDatabase,
  isPostgres,
  getBackupDir,
};
