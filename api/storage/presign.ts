// Backblaze B2 S3-Compatible Presigned URL API
// Returns a presigned URL for browser-side file uploads via S3 API

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, createHash } from 'crypto';

// B2 S3-compatible endpoint
const B2_S3_ENDPOINT = 'https://s3.us-west-004.backblazeb2.com';
const BUCKET_NAME = 'admachin';
const REGION = 'us-west-004';

function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
    const kDate = createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(region).digest();
    const kService = createHmac('sha256', kRegion).update(service).digest();
    const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
}

function generatePresignedUrl(
    accessKeyId: string,
    secretKey: string,
    bucketName: string,
    objectKey: string,
    contentType: string,
    expiresIn: number = 3600
): string {
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = now.toISOString().replace(/[:-]|\.\d+/g, '');

    const host = `${bucketName}.${B2_S3_ENDPOINT.replace('https://', '')}`;
    const credential = `${accessKeyId}/${dateStamp}/${REGION}/s3/aws4_request`;

    const canonicalQueryString = [
        `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
        `X-Amz-Credential=${encodeURIComponent(credential)}`,
        `X-Amz-Date=${amzDate}`,
        `X-Amz-Expires=${expiresIn}`,
        `X-Amz-SignedHeaders=content-type%3Bhost`,
    ].sort().join('&');

    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
    const signedHeaders = 'content-type;host';

    const canonicalRequest = [
        'PUT',
        `/${objectKey}`,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        'UNSIGNED-PAYLOAD',
    ].join('\n');

    const hashedCanonicalRequest = createHash('sha256').update(canonicalRequest).digest('hex');

    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        `${dateStamp}/${REGION}/s3/aws4_request`,
        hashedCanonicalRequest,
    ].join('\n');

    const signingKey = getSigningKey(secretKey, dateStamp, REGION, 's3');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return `https://${host}/${objectKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { fileName, contentType } = req.body as {
            fileName: string;
            contentType: string;
        };

        if (!fileName) {
            return res.status(400).json({ error: 'fileName is required' });
        }

        const keyId = process.env.B2_APPLICATION_KEY_ID?.trim();
        const appKey = process.env.B2_APPLICATION_KEY?.trim();

        if (!keyId || !appKey) {
            return res.status(500).json({ error: 'B2 credentials not configured' });
        }

        // Generate unique object key
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const ext = fileName.split('.').pop() || 'bin';
        const objectKey = `creatives/${timestamp}-${randomStr}.${ext}`;

        console.log('[B2 S3] Generating presigned URL for:', objectKey);

        // Generate presigned URL
        const presignedUrl = generatePresignedUrl(
            keyId,
            appKey,
            BUCKET_NAME,
            objectKey,
            contentType || 'application/octet-stream',
            3600 // 1 hour expiry
        );

        // Construct public URL
        const publicUrl = `${B2_S3_ENDPOINT}/${BUCKET_NAME}/${objectKey}`;

        return res.status(200).json({
            uploadUrl: presignedUrl,
            objectKey,
            publicUrl,
        });
    } catch (error) {
        console.error('[B2 S3] Error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to generate presigned URL',
        });
    }
}
