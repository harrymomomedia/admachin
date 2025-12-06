import * as fs from 'fs';
import * as path from 'path';
import { kv } from '@vercel/kv';

const STORAGE_FILE = path.resolve(process.cwd(), '.auth_store.json');
const KV_KEY = 'momomedia_team_session';

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
            // Strategy 1: Vercel KV (Production/Cloud)
            if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
                console.log('[TokenStorage] Saving to Vercel KV');
                await kv.set(KV_KEY, session);
                return;
            }

            // Strategy 2: Local File System (Development)
            const data = JSON.stringify(session, null, 2);
            await fs.promises.writeFile(STORAGE_FILE, data, 'utf-8');
            console.log('[TokenStorage] Session saved to local file', STORAGE_FILE);
        } catch (error) {
            console.error('[TokenStorage] Failed to save session:', error);
            throw error;
        }
    },

    async get(): Promise<StoredSession | null> {
        try {
            // Strategy 1: Vercel KV
            if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
                const session = await kv.get<StoredSession>(KV_KEY);
                return session;
            }

            // Strategy 2: Local File System
            if (!fs.existsSync(STORAGE_FILE)) {
                return null;
            }
            const data = await fs.promises.readFile(STORAGE_FILE, 'utf-8');
            return JSON.parse(data) as StoredSession;
        } catch (error) {
            console.warn('[TokenStorage] Failed to read session:', error);
            return null;
        }
    },

    async clear(): Promise<void> {
        try {
            if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
                await kv.del(KV_KEY);
                return;
            }

            if (fs.existsSync(STORAGE_FILE)) {
                await fs.promises.unlink(STORAGE_FILE);
            }
        } catch (error) {
            console.error('[TokenStorage] Failed to clear session:', error);
        }
    }
};
