// Backblaze B2 Client-Side Storage Service
// Uploads files via our backend proxy to bypass B2 CORS limitations

export interface B2UploadResult {
    fileId: string;
    fileName: string;
    url: string;
    contentType: string;
    contentLength: number;
}

/**
 * Convert File to base64 string
 */
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Upload a file to Backblaze B2 via our backend proxy
 */
export async function uploadToB2(
    file: File,
    onProgress?: (progress: number) => void
): Promise<B2UploadResult> {
    if (onProgress) onProgress(10);

    // Convert file to base64
    console.log('[B2] Converting file to base64...');
    const fileData = await fileToBase64(file);

    if (onProgress) onProgress(30);

    console.log('[B2] Uploading via proxy...', file.name, 'size:', file.size);

    // Upload via our backend proxy
    const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fileData,
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
        }),
    });

    if (onProgress) onProgress(90);

    if (!response.ok) {
        const error = await response.json();
        console.error('[B2] Upload failed:', error);
        throw new Error(error.error || 'Failed to upload file');
    }

    const result = await response.json();

    if (onProgress) onProgress(100);

    console.log('[B2] Upload successful:', result.url);

    return {
        fileId: result.fileId,
        fileName: result.fileName,
        url: result.url,
        contentType: result.contentType,
        contentLength: result.contentLength,
    };
}

/**
 * Get the public URL for a B2 file
 */
export function getB2PublicUrl(fileName: string): string {
    // This assumes a public bucket named 'admachin'
    // Adjust the bucket name if different
    return `https://f004.backblazeb2.com/file/admachin/${fileName}`;
}
