import db from '../db/index.js';

export class Payment {
    static async create(userId, amount, status = 'pending') {
        const result = await db.run(
            'INSERT INTO payments (user_id, amount, status) VALUES (?, ?, ?)',
            [userId, amount, status]
        );
        return { id: result.lastID, user_id: userId, amount, status };
    }

    static async updateStatus(id, status) {
        await db.run(
            'UPDATE payments SET status = ? WHERE id = ?',
            [status, id]
        );
        return db.get('SELECT * FROM payments WHERE id = ?', [id]);
    }

    static async getUserPayments(userId) {
        return db.all('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    }

    static async getStats() {
        const stats = await db.get(`
            SELECT 
                COUNT(*) as total_payments,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
                COUNT(DISTINCT user_id) as unique_payers
            FROM payments
        `);
        return stats;
    }

    static async getRecent() {
        return db.all(`
            SELECT p.*, u.wallet_address 
            FROM payments p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 10
        `);
    }
} 