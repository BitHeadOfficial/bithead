import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import db from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrateWhitelist() {
    try {
        console.log('Starting whitelist migration...');
        
        // Read whitelist.json
        const whitelistPath = path.join(__dirname, '..', 'whitelist.json');
        console.log('Reading whitelist from:', whitelistPath);
        
        if (!fs.existsSync(whitelistPath)) {
            console.error('whitelist.json not found');
            process.exit(1);
        }

        const whitelistData = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'));
        console.log(`Found ${whitelistData.length} entries in whitelist.json`);

        // Ensure users table has the correct schema
        await new Promise((resolve, reject) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wallet_address TEXT UNIQUE,
                    email TEXT UNIQUE,
                    is_premium BOOLEAN DEFAULT FALSE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating/updating users table:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        let successCount = 0;
        let errorCount = 0;

        // Add each entry to the database
        for (const entry of whitelistData) {
            try {
                const walletAddress = entry.walletAddress || entry.wallet_address;
                const email = entry.email || null;

                // Validate entry
                if (!walletAddress && !email) {
                    console.error('Invalid entry - missing both wallet address and email:', entry);
                    errorCount++;
                    continue;
                }

                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT OR REPLACE INTO users (
                            wallet_address, 
                            email, 
                            created_at, 
                            updated_at
                        ) VALUES (?, ?, datetime('now'), datetime('now'))`,
                        [walletAddress, email],
                        function(err) {
                            if (err) {
                                console.error('Error adding/updating user:', err);
                                errorCount++;
                                reject(err);
                            } else {
                                if (this.changes > 0) {
                                    console.log('Added/Updated user:', { wallet: walletAddress, email });
                                    successCount++;
                                } else {
                                    console.log('No changes needed for:', { wallet: walletAddress, email });
                                }
                                resolve();
                            }
                        }
                    );
                });
            } catch (error) {
                console.error('Error processing entry:', error);
                errorCount++;
            }
        }

        console.log('\nMigration Summary:');
        console.log(`Total entries processed: ${whitelistData.length}`);
        console.log(`Successful migrations: ${successCount}`);
        console.log(`Failed migrations: ${errorCount}`);
        console.log('\nMigration completed!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateWhitelist(); 