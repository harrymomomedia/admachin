// Backblaze B2 Client-Side Storage Service
// Uploads files to B2 using S3-compatible presigned URLs

export interface B2UploadResult {
    fileId: string;
    fileName: string;
    url: string;
    contentType: string;
    contentLength: number;
}

interface PresignedUrlResponse {
    uploadUrl: string;
    objectKey: string;
    publicUrl: string;
}

/**
 * Get a presigned URL from our backend
 */
async function getPresignedUrl(fileName: string, contentType: string): Promise<PresignedUrlResponse> {
    const response = await fetch('/api/storage/presign', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName, contentType }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get presigned URL');
    }

    return await response.json();
}

/**
 * Upload a file to Backblaze B2 using S3 presigned URL
 */
export async function uploadToB2(
    file: File,
    onProgress?: (progress: number) => void
): Promise<B2UploadResult> {
    if (onProgress) onProgress(5);

    // Get presigned URL from backend
    console.log('[B2] Getting presigned URL for:', file.name);
    const presigned = await getPresignedUrl(file.name, file.type || 'application/octet-stream');

    if (onProgress) onProgress(15);

    console.log('[B2] Uploading to S3-compatible endpoint...');

    // Upload directly to B2 via S3 presigned URL
    const response = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
    });

    if (onProgress) onProgress(90);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[B2] Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status}`);
    }

    if (onProgress) onProgress(100);

    console.log('[B2] Upload successful:', presigned.publicUrl);

    return {
        fileId: presigned.objectKey,
        fileName: presigned.objectKey,
        url: presigned.publicUrl,
        contentType: file.type || 'application/octet-stream',
        contentLength: file.size,
    };
}

/**
 * Get the public URL for a B2 file
 */
export function getB2PublicUrl(fileName: string): string {
    return `https://s3.us-west-004.backblazeb2.com/admachin/${fileName}`;
}
