import bcrypt from 'bcryptjs';
import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

const [,, username, password] = process.argv;

if (!username || !password) {
  console.error('Usage: node scripts/create-admin-user.js <username> <password>');
  process.exit(1);
}

(async () => {
  try {
    const hash = await bcrypt.hash(password, 10);
    db.run(
      'INSERT OR REPLACE INTO admin_users (username, password_hash, is_active) VALUES (?, ?, 1)',
      [username, hash],
      function(err) {
        if (err) {
          console.error('Error creating admin user:', err.message);
        } else {
          console.log(`Admin user '${username}' created/updated successfully.`);
        }
        db.close();
      }
    );
  } catch (err) {
    console.error('Error:', err);
    db.close();
  }
})(); 