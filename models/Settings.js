import db from '../db/index.js';

export class Settings {
    static async getAll() {
        const settings = await db.all('SELECT * FROM settings');
        return settings.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
        }, {});
    }

    static async update(key, value) {
        await db.run(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            [key, value]
        );
    }

    static async get(key) {
        const setting = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
        return setting ? setting.value : null;
    }

    static async set(key, value, updatedBy) {
        const result = await query(
            `INSERT INTO settings (key, value, updated_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (key) 
            DO UPDATE SET 
                value = $2,
                updated_at = CURRENT_TIMESTAMP,
                updated_by = $3
            RETURNING *`,
            [key, value, updatedBy]
        );
        return result.rows[0];
    }

    static async getHistory(key, limit = 10) {
        const result = await query(
            `SELECT * FROM settings_history 
            WHERE key = $1 
            ORDER BY updated_at DESC 
            LIMIT $2`,
            [key, limit]
        );
        return result.rows;
    }

    static async validateSettings(settings) {
        const requiredSettings = [
            'access_password',
            'recipient_wallet',
            'rate_limit_window',
            'rate_limit_max'
        ];

        const missingSettings = requiredSettings.filter(
            setting => !settings[setting]
        );

        if (missingSettings.length > 0) {
            throw new Error(`Missing required settings: ${missingSettings.join(', ')}`);
        }

        return true;
    }
} 