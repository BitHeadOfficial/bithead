import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'data', 'bithead.db');
const db = new sqlite3.Database(dbPath);

const [,, username, password] = process.argv;

if (!username || !password) {
  console.error('Usage: node scripts/create-admin-user.js <username> <password>');
  process.exit(1);
}

(async () => {
  try {
    // First ensure the admin_users table exists
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          logger.error('Error creating admin_users table:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Then create/update the admin user
    const hash = await bcrypt.hash(password, 10);
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO admin_users (username, password_hash, is_active, updated_at) VALUES (?, ?, 1, datetime("now"))',
        [username, hash],
        function(err) {
          if (err) {
            logger.error('Error creating/updating admin user:', err);
            reject(err);
          } else {
            if (this.changes > 0) {
              logger.info(`Admin user '${username}' created/updated successfully`);
            } else {
              logger.info(`No changes needed for admin user '${username}'`);
            }
            resolve();
          }
        }
      );
    });
  } catch (err) {
    logger.error('Error:', err);
  } finally {
    db.close();
  }
})(); 