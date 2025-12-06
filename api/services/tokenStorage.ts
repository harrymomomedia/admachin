import * as fs from 'fs';
import * as path from 'path';
import { Redis } from '@upstash/redis';

const STORAGE_FILE = path.resolve(process.cwd(), '.auth_store.json');
const KV_KEY = 'momomedia_team_session';

// Helper to get the Redis client
function getRedisClient() {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    console.log('[TokenStorage] Checking Env Vars -> URL:', !!url, 'Token:', !!token);

    if (url && token) {
        return new Redis({ url, token });
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
            const redis = getRedisClient();

            // Strategy 1: Redis (Production/Cloud)
            if (redis) {
                console.log('[TokenStorage] Saving to Redis');
                await redis.set(KV_KEY, session);
                return;
            }

            // Guard: If we are in Production but NO Redis, we must throw or log error, 
            // NOT try to write to filesystem (which causes Crash 500)
            if (process.env.NODE_ENV === 'production') {
                console.error('[TokenStorage] CRITICAL: Redis not configured in Production. Cannot save session.');
                // Return gracefully to avoid crashing the user flow, but connection won't persist
                return;
            }

            // Strategy 2: Local File System (Development ONLY)
            const data = JSON.stringify(session, null, 2);
            await fs.promises.writeFile(STORAGE_FILE, data, 'utf-8');
            console.log('[TokenStorage] Session saved to local file', STORAGE_FILE);
        } catch (error) {
            console.error('[TokenStorage] Failed to save session:', error);
            // Do not throw, just log. Throwing causes 500 Page which scares users.
        }
    },

    async get(): Promise<StoredSession | null> {
        try {
            const redis = getRedisClient();

            // Strategy 1: Redis
            if (redis) {
                const session = await redis.get<StoredSession>(KV_KEY);
                return session;
            }

            // Strategy 2: Local File System (Development ONLY)
            // In production, we should not fall back to file system.
            if (process.env.NODE_ENV === 'production') {
                console.warn('[TokenStorage] Redis not configured in Production. Cannot retrieve session from file system.');
                return null;
            }

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
            const redis = getRedisClient();

            if (redis) {
                await redis.del(KV_KEY);
                return;
            }

            // In production, we should not fall back to file system.
            if (process.env.NODE_ENV === 'production') {
                console.warn('[TokenStorage] Redis not configured in Production. Cannot clear session from file system.');
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
