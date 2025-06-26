import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const dbPath = process.env.BITHEAD_DB_PATH || (isProduction
  ? '/opt/render/project/src/data/bithead.db'
  : join(__dirname, '..', 'data', 'bithead.db'));
console.log('Using database at:', dbPath);
const db = new sqlite3.Database(dbPath);

const [,, username, password] = process.argv;

if (!username || !password) {
  console.error('Usage: node scripts/create-admin-user.js <username> <password>');
  process.exit(1);
}

console.log('Creating admin user:', username);

(async () => {
  try {
    // First ensure the admin_users table exists
    console.log('Ensuring admin_users table exists...');
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
          console.error('Error creating admin_users table:', err);
          logger.error('Error creating admin_users table:', err);
          reject(err);
        } else {
          console.log('admin_users table ready');
          resolve();
        }
      });
    });

    // Then create/update the admin user
    console.log('Hashing password...');
    const hash = await bcrypt.hash(password, 10);
    console.log('Password hashed, inserting user...');
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO admin_users (username, password_hash, is_active, updated_at) VALUES (?, ?, 1, datetime("now"))',
        [username, hash],
        function(err) {
          if (err) {
            console.error('Error creating/updating admin user:', err);
            logger.error('Error creating/updating admin user:', err);
            reject(err);
          } else {
            if (this.changes > 0) {
              console.log(`Admin user '${username}' created/updated successfully (${this.changes} rows affected)`);
              logger.info(`Admin user '${username}' created/updated successfully`);
            } else {
              console.log(`No changes needed for admin user '${username}'`);
              logger.info(`No changes needed for admin user '${username}'`);
            }
            resolve();
          }
        }
      );
    });

    // Verify the user was created
    console.log('Verifying user creation...');
    await new Promise((resolve, reject) => {
      db.get('SELECT username, is_active FROM admin_users WHERE username = ?', [username], (err, row) => {
        if (err) {
          console.error('Error verifying user:', err);
          reject(err);
        } else if (row) {
          console.log('User verified:', row);
          resolve();
        } else {
          console.error('User not found after creation!');
          reject(new Error('User not found after creation'));
        }
      });
    });
  } catch (err) {
    console.error('Error:', err);
    logger.error('Error:', err);
  } finally {
    db.close();
  }
})(); 