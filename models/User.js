import db from '../db/index.js';

export class User {
    static async findByWalletAddress(walletAddress) {
        return db.get('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
    }

    static async create(walletAddress) {
        const result = await db.run(
            'INSERT INTO users (wallet_address) VALUES (?)',
            [walletAddress]
        );
        return { id: result.lastID, wallet_address: walletAddress };
    }

    static async updateGenesisStatus(userId, isGenesis) {
        return db.run(
            'UPDATE users SET is_premium = ? WHERE id = ?',
            [isGenesis, userId]
        );
    }

    static async getGenesisUsers() {
        return db.all('SELECT * FROM users WHERE is_premium = 1');
    }
} 