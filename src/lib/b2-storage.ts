// Backblaze B2 Client-Side Storage Service
// Handles file uploads directly to B2 from the browser

export interface B2UploadResult {
    fileId: string;
    fileName: string;
    url: string;
    contentType: string;
    contentLength: number;
}

interface B2UploadCredentials {
    uploadUrl: string;
    authorizationToken: string;
    bucketId: string;
    downloadUrl: string;
}

/**
 * Get upload credentials from our backend
 */
async function getUploadCredentials(): Promise<B2UploadCredentials> {
    const response = await fetch('/api/storage/upload-url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get upload credentials');
    }

    return await response.json();
}

/**
 * Calculate SHA1 hash of a file (required by B2)
 */
async function calculateSHA1(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload a file to Backblaze B2
 */
export async function uploadToB2(
    file: File,
    onProgress?: (progress: number) => void
): Promise<B2UploadResult> {
    // Get upload credentials from backend
    const credentials = await getUploadCredentials();

    if (onProgress) onProgress(10);

    // Calculate SHA1 hash
    const sha1Hash = await calculateSHA1(file);

    if (onProgress) onProgress(20);

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop() || 'bin';
    const safeFileName = `creatives/${timestamp}-${randomStr}.${ext}`;

    // Upload directly to B2
    const response = await fetch(credentials.uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': credentials.authorizationToken,
            'Content-Type': file.type || 'application/octet-stream',
            'Content-Length': String(file.size),
            'X-Bz-File-Name': encodeURIComponent(safeFileName),
            'X-Bz-Content-Sha1': sha1Hash,
        },
        body: file,
    });

    if (onProgress) onProgress(90);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[B2] Upload failed:', errorText);
        throw new Error('Failed to upload file to B2');
    }

    const result = await response.json();

    if (onProgress) onProgress(100);

    // Construct the public download URL
    // Format: {downloadUrl}/file/{bucketName}/{fileName}
    // Note: We use /b2api/v2/b2_download_file_by_id for private buckets
    // For public buckets, use: {downloadUrl}/file/{bucketName}/{fileName}
    const publicUrl = `${credentials.downloadUrl}/file/admachin-creatives/${safeFileName}`;

    return {
        fileId: result.fileId,
        fileName: safeFileName,
        url: publicUrl,
        contentType: file.type,
        contentLength: file.size,
    };
}

/**
 * Get the public URL for a B2 file
 */
export function getB2PublicUrl(fileName: string): string {
    // This assumes a public bucket named 'admachin-creatives'
    // Adjust the bucket name if different
    return `https://f005.backblazeb2.com/file/admachin-creatives/${fileName}`;
}
