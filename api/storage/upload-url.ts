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
    console.log('[B2] keyId full length:', keyId?.length);

    if (!keyId || !appKey) {
        throw new Error('B2 credentials not configured');
    }

    // Trim any whitespace that might have been introduced
    const trimmedKeyId = keyId.trim();
    const trimmedAppKey = appKey.trim();

    const credentials = Buffer.from(`${trimmedKeyId}:${trimmedAppKey}`).toString('base64');
    console.log('[B2] Credentials base64 length:', credentials.length);

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
        console.error('[B2] keyId used:', trimmedKeyId);
        console.error('[B2] appKey first 4 chars:', trimmedAppKey.substring(0, 4));
        throw new Error(`Failed to authenticate with B2: ${response.status} - ${error}`);
    }

    const data = await response.json() as B2AuthResponse;

    // Cache the auth
    cachedAuth = { data, timestamp: Date.now() };

    return data;
}

async function getUploadUrl(auth: B2AuthResponse): Promise<B2UploadUrlResponse> {
    const bucketId = process.env.B2_BUCKET_ID;

    console.log('[B2] getUploadUrl - bucketId:', bucketId);
    console.log('[B2] getUploadUrl - apiUrl:', auth.apiUrl);
    console.log('[B2] getUploadUrl - auth token present:', !!auth.authorizationToken);

    if (!bucketId) {
        throw new Error('B2 bucket ID not configured');
    }

    const url = `${auth.apiUrl}/b2api/v2/b2_get_upload_url`;
    console.log('[B2] Calling:', url);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': auth.authorizationToken,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bucketId: bucketId.trim() }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('[B2] Get upload URL failed with status:', response.status);
        console.error('[B2] Get upload URL error:', error);
        throw new Error(`Failed to get upload URL: ${response.status} - ${error}`);
    }

    const result = await response.json() as B2UploadUrlResponse;
    console.log('[B2] Got upload URL successfully');
    return result;
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
