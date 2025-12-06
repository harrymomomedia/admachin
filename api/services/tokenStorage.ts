import { Redis } from '@upstash/redis';

const KV_KEY = 'momomedia_team_session';

// Helper to get the Redis client
function getRedisClient(): Redis | null {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    console.log('[TokenStorage] Redis URL exists:', !!url);
    console.log('[TokenStorage] Redis Token exists:', !!token);

    if (url && token) {
        try {
            return new Redis({ url, token });
        } catch (err) {
            console.error('[TokenStorage] Failed to create Redis client:', err);
            return null;
        }
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
        console.log('[TokenStorage] Attempting to save session...');

        try {
            const redis = getRedisClient();

            if (!redis) {
                console.error('[TokenStorage] CRITICAL: No Redis client available. Env vars missing?');
                console.error('[TokenStorage] URL:', process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'MISSING');
                console.error('[TokenStorage] Token:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'MISSING');
                // Don't throw - just return. The app can still work without persistence.
                return;
            }

            console.log('[TokenStorage] Redis client created, saving to key:', KV_KEY);
            await redis.set(KV_KEY, session);
            console.log('[TokenStorage] Session saved successfully to Redis');
        } catch (error) {
            console.error('[TokenStorage] Failed to save session:', error);
            // Don't throw - gracefully degrade
        }
    },

    async get(): Promise<StoredSession | null> {
        console.log('[TokenStorage] Attempting to get session...');

        try {
            const redis = getRedisClient();

            if (!redis) {
                console.warn('[TokenStorage] No Redis client available');
                return null;
            }

            console.log('[TokenStorage] Fetching from Redis...');
            const session = await redis.get<StoredSession>(KV_KEY);
            console.log('[TokenStorage] Session retrieved:', !!session);
            return session;
        } catch (error) {
            console.error('[TokenStorage] Failed to read session:', error);
            return null;
        }
    },

    async clear(): Promise<void> {
        console.log('[TokenStorage] Attempting to clear session...');

        try {
            const redis = getRedisClient();

            if (!redis) {
                console.warn('[TokenStorage] No Redis client available');
                return;
            }

            await redis.del(KV_KEY);
            console.log('[TokenStorage] Session cleared successfully');
        } catch (error) {
            console.error('[TokenStorage] Failed to clear session:', error);
        }
    }
};

