import db from '../db/index.js';

export class AccessLog {
    static async create(userId, action) {
        const result = await db.run(
            'INSERT INTO access_logs (user_id, action) VALUES (?, ?)',
            [userId, action]
        );
        return { id: result.lastID, user_id: userId, action };
    }

    static async getUserLogs(userId) {
        return db.all(
            'SELECT * FROM access_logs WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
    }

    static async getRecentLogs(limit = 50) {
        return db.all(`
            SELECT l.*, u.wallet_address 
            FROM access_logs l
            JOIN users u ON l.user_id = u.id
            ORDER BY l.created_at DESC
            LIMIT ?
        `, [limit]);
    }

    static async getActionStats(action, timeRange = '24') {
        // In SQLite, we use strftime for date/time functions
        return db.get(`
            SELECT 
                COUNT(*) as total_attempts,
                SUM(CASE WHEN details LIKE '%success%' THEN 1 ELSE 0 END) as successful_attempts
            FROM access_logs 
            WHERE action = ?
            AND created_at >= datetime('now', '-' || ? || ' hours')
        `, [action, timeRange]);
    }

    static async getFailedAttempts(userId, timeRange = '1') {
        // In SQLite, we use strftime for date/time functions
        const result = db.get(`
            SELECT COUNT(*) as count
            FROM access_logs 
            WHERE user_id = ?
            AND details LIKE '%failed%'
            AND created_at >= datetime('now', '-' || ? || ' hours')
        `, [userId, timeRange]);
        return result ? result.count : 0;
    }
} 