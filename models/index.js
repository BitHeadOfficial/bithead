import { User } from './User.js';
import { Payment } from './Payment.js';
import { AccessLog } from './AccessLog.js';
import { Settings } from './Settings.js';

export {
    User,
    Payment,
    AccessLog,
    Settings
};

export class LogoSubmission {
    static async create(db, { walletAddress, logoUrl, amount, position }) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO logo_submissions (wallet_address, logo_url, amount, position, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            `;
            db.run(sql, [walletAddress, logoUrl, amount, position], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    static async getLatest(db) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM logo_submissions 
                ORDER BY position DESC, created_at DESC
            `;
            db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    static async getCount(db) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT COUNT(*) as count FROM logo_submissions';
            db.get(sql, [], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
    }

    static async getNextPosition(db) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT MAX(position) as maxPosition FROM logo_submissions';
            db.get(sql, [], (err, row) => {
                if (err) reject(err);
                else resolve((row.maxPosition || 0) + 1);
            });
        });
    }
} 