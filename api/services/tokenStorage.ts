import * as fs from 'fs';
import * as path from 'path';

const STORAGE_FILE = path.resolve(process.cwd(), '.auth_store.json');

export interface StoredSession {
    accessToken: string;
    tokenExpiry: number;
    userName: string;
    userId: string;
    connectedAt: number;
}

export const TokenStorage = {
    async save(session: StoredSession): Promise<void> {
        try {
            // In a real Edge environment (Vercel Edge Functions), 'fs' is not available.
            // This implementation is specifically for the Local Node.js environment/Vercel Serverless (Node).
            // For Edge/KV, we would use @vercel/kv or similar.

            const data = JSON.stringify(session, null, 2);
            await fs.promises.writeFile(STORAGE_FILE, data, 'utf-8');
            console.log('[TokenStorage] Session saved to', STORAGE_FILE);
        } catch (error) {
            console.error('[TokenStorage] Failed to save session:', error);
            throw error; // Propagate error
        }
    },

    async get(): Promise<StoredSession | null> {
        try {
            if (!fs.existsSync(STORAGE_FILE)) {
                return null;
            }
            const data = await fs.promises.readFile(STORAGE_FILE, 'utf-8');
            return JSON.parse(data) as StoredSession;
        } catch (error) {
            console.warn('[TokenStorage] Failed to read session (might be empty):', error);
            return null;
        }
    },

    async clear(): Promise<void> {
        try {
            if (fs.existsSync(STORAGE_FILE)) {
                await fs.promises.unlink(STORAGE_FILE);
            }
        } catch (error) {
            console.error('[TokenStorage] Failed to clear session:', error);
        }
    }
};
