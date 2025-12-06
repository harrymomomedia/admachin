// Backblaze B2 Upload URL API
// Returns temporary upload credentials for browser-side file uploads

import type { VercelRequest, VercelResponse } from '@vercel/node';

const B2_API_URL = 'https://api.backblazeb2.com/b2api/v2';

interface B2AuthResponse {
    authorizationToken: string;
    apiUrl: string;
    downloadUrl: string;
    recommendedPartSize: number;
    absoluteMinimumPartSize: number;
    allowed: {
        bucketId: string;
        bucketName: string;
        capabilities: string[];
        namePrefix: string | null;
    };
}

interface B2UploadUrlResponse {
    uploadUrl: string;
    authorizationToken: string;
    bucketId: string;
}

// Cache auth token (valid for 24 hours, we'll refresh every hour)
let cachedAuth: { data: B2AuthResponse; timestamp: number } | null = null;
const AUTH_CACHE_MS = 60 * 60 * 1000; // 1 hour

async function getB2Auth(): Promise<B2AuthResponse> {
    // Check cache
    if (cachedAuth && Date.now() - cachedAuth.timestamp < AUTH_CACHE_MS) {
        return cachedAuth.data;
    }

    const keyId = process.env.B2_APPLICATION_KEY_ID;
    const appKey = process.env.B2_APPLICATION_KEY;

    console.log('[B2] Auth attempt with keyId:', keyId?.substring(0, 8) + '...');
    console.log('[B2] appKey present:', !!appKey, 'length:', appKey?.length);

    if (!keyId || !appKey) {
        throw new Error('B2 credentials not configured');
    }

    const credentials = Buffer.from(`${keyId}:${appKey}`).toString('base64');

    const response = await fetch(`${B2_API_URL}/b2_authorize_account`, {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${credentials}`,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('[B2] Auth failed with status:', response.status);
        console.error('[B2] Auth failed response:', error);
        throw new Error('Failed to authenticate with B2');
    }

    const data = await response.json() as B2AuthResponse;

    // Cache the auth
    cachedAuth = { data, timestamp: Date.now() };

    return data;
}

async function getUploadUrl(auth: B2AuthResponse): Promise<B2UploadUrlResponse> {
    const bucketId = process.env.B2_BUCKET_ID;

    if (!bucketId) {
        throw new Error('B2 bucket ID not configured');
    }

    const response = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: {
            'Authorization': auth.authorizationToken,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bucketId }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('[B2] Get upload URL failed:', error);
        throw new Error('Failed to get upload URL');
    }

    return await response.json() as B2UploadUrlResponse;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get B2 auth (cached)
        const auth = await getB2Auth();

        // Get fresh upload URL (these are single-use)
        const uploadData = await getUploadUrl(auth);

        // Return the upload credentials
        // Also include the download URL for constructing public URLs later
        return res.status(200).json({
            uploadUrl: uploadData.uploadUrl,
            authorizationToken: uploadData.authorizationToken,
            bucketId: uploadData.bucketId,
            downloadUrl: auth.downloadUrl,
        });
    } catch (error) {
        console.error('[B2] Upload URL error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get upload URL',
        });
    }
}
