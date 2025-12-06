import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@vercel/kv';

const STORAGE_FILE = path.resolve(process.cwd(), '.auth_store.json');
const KV_KEY = 'momomedia_team_session';

// Helper to get the Redis client regardless of Provider (Vercel KV or Upstash)
function getKvClient() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
        return createClient({ url, token });
    }
    return null;
}

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
            const kv = getKvClient();

            // Strategy 1: Redis (Production/Cloud)
            if (kv) {
                console.log('[TokenStorage] Saving to Redis/KV');
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
            const kv = getKvClient();

            // Strategy 1: Redis
            if (kv) {
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
            const kv = getKvClient();

            if (kv) {
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
