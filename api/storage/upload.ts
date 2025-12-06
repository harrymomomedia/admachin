// Backblaze B2 Upload Proxy API
// Proxies file uploads through our server to bypass B2 CORS limitations

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

const B2_API_URL = 'https://api.backblazeb2.com/b2api/v2';

interface B2AuthResponse {
    authorizationToken: string;
    apiUrl: string;
    downloadUrl: string;
}

interface B2UploadUrlResponse {
    uploadUrl: string;
    authorizationToken: string;
    bucketId: string;
}

// Cache auth token
let cachedAuth: { data: B2AuthResponse; timestamp: number } | null = null;
const AUTH_CACHE_MS = 60 * 60 * 1000; // 1 hour

async function getB2Auth(): Promise<B2AuthResponse> {
    if (cachedAuth && Date.now() - cachedAuth.timestamp < AUTH_CACHE_MS) {
        return cachedAuth.data;
    }

    const keyId = process.env.B2_APPLICATION_KEY_ID?.trim();
    const appKey = process.env.B2_APPLICATION_KEY?.trim();

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
        console.error('[B2] Auth failed:', error);
        throw new Error('Failed to authenticate with B2');
    }

    const data = await response.json() as B2AuthResponse;
    cachedAuth = { data, timestamp: Date.now() };
    return data;
}

async function getUploadUrl(auth: B2AuthResponse): Promise<B2UploadUrlResponse> {
    const bucketId = process.env.B2_BUCKET_ID?.trim();

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

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '50mb',
        },
    },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name, X-Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get file data from request body (base64 encoded)
        const { fileData, fileName, contentType } = req.body as {
            fileData: string;
            fileName: string;
            contentType: string;
        };

        if (!fileData || !fileName) {
            return res.status(400).json({ error: 'Missing fileData or fileName' });
        }

        // Decode base64 file data
        const fileBuffer = Buffer.from(fileData, 'base64');

        // Calculate SHA1 hash
        const sha1Hash = createHash('sha1').update(fileBuffer).digest('hex');

        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const ext = fileName.split('.').pop() || 'bin';
        const safeFileName = `creatives/${timestamp}-${randomStr}.${ext}`;

        console.log('[B2 Proxy] Uploading file:', safeFileName, 'size:', fileBuffer.length);

        // Get B2 auth and upload URL
        const auth = await getB2Auth();
        const uploadData = await getUploadUrl(auth);

        // Upload to B2
        const uploadResponse = await fetch(uploadData.uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': uploadData.authorizationToken,
                'Content-Type': contentType || 'application/octet-stream',
                'Content-Length': String(fileBuffer.length),
                'X-Bz-File-Name': encodeURIComponent(safeFileName),
                'X-Bz-Content-Sha1': sha1Hash,
            },
            body: fileBuffer,
        });

        if (!uploadResponse.ok) {
            const error = await uploadResponse.text();
            console.error('[B2 Proxy] Upload failed:', error);
            return res.status(500).json({ error: 'Failed to upload to B2' });
        }

        const result = await uploadResponse.json() as { fileId: string; fileName: string };

        // Construct public URL
        const publicUrl = `${auth.downloadUrl}/file/admachin/${safeFileName}`;

        console.log('[B2 Proxy] Upload successful:', publicUrl);

        return res.status(200).json({
            fileId: result.fileId,
            fileName: safeFileName,
            url: publicUrl,
            contentType: contentType,
            contentLength: fileBuffer.length,
        });
    } catch (error) {
        console.error('[B2 Proxy] Error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Upload failed',
        });
    }
}
