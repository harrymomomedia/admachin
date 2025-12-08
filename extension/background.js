// Background service worker for the extension

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'saveAd') {
        handleSaveAd(message.data).then(sendResponse);
        return true; // Keep the message channel open for async response
    }

    if (message.action === 'downloadMedia') {
        handleDownloadMedia(message.mediaItems).then(sendResponse);
        return true;
    }
});

// Download media in background (bypasses CORS)
async function handleDownloadMedia(mediaItems) {
    const results = [];

    for (const item of mediaItems.slice(0, 5)) {
        try {
            // Skip blob URLs - they only exist in the page context
            if (item.url && (item.url.startsWith('blob:') || item.url === 'blob_video')) {
                // Try to download the poster instead
                if (item.poster && !item.poster.startsWith('blob:')) {
                    const posterResult = await downloadSingleFile(item.poster, 'image');
                    if (posterResult.success) {
                        results.push({
                            ...item,
                            base64: posterResult.base64,
                            mimeType: posterResult.mimeType,
                            size: posterResult.size,
                            isPosterOnly: true
                        });
                        continue;
                    }
                }
                results.push({ ...item, error: 'blob_url_not_accessible' });
                continue;
            }

            // Download the actual media
            if (item.url) {
                const result = await downloadSingleFile(item.url, item.type);
                if (result.success) {
                    results.push({
                        ...item,
                        base64: result.base64,
                        mimeType: result.mimeType,
                        size: result.size
                    });
                } else {
                    // Try poster as fallback for videos
                    if (item.type === 'video' && item.poster && !item.poster.startsWith('blob:')) {
                        const posterResult = await downloadSingleFile(item.poster, 'image');
                        if (posterResult.success) {
                            results.push({
                                ...item,
                                base64: posterResult.base64,
                                mimeType: posterResult.mimeType,
                                size: posterResult.size,
                                isPosterOnly: true
                            });
                            continue;
                        }
                    }
                    results.push({ ...item, error: result.error });
                }
            }

        } catch (error) {
            console.error('Background download error:', error);
            results.push({ ...item, error: error.message });
        }
    }

    return { success: true, media: results };
}

// Download a single file and convert to base64
async function downloadSingleFile(url, type) {
    try {
        console.log(`Background: Downloading ${type} from ${url.substring(0, 80)}...`);

        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit' // Don't send cookies - background doesn't have them anyway
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();

        // Convert to base64
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('FileReader error'));
            reader.readAsDataURL(blob);
        });

        console.log(`Background: Downloaded ${type} (${Math.round(blob.size / 1024)}KB)`);

        return {
            success: true,
            base64,
            mimeType: blob.type,
            size: blob.size
        };

    } catch (error) {
        console.error(`Background: Failed to download ${type}:`, error);
        return { success: false, error: error.message };
    }
}

async function handleSaveAd(adData) {
    try {
        const { apiUrl, supabaseKey } = await chrome.storage.local.get(['apiUrl', 'supabaseKey']);

        if (!supabaseKey) {
            return { success: false, error: 'Supabase key not configured' };
        }

        const baseUrl = apiUrl || 'https://admachin.vercel.app';

        const response = await fetch(`${baseUrl}/api/save-fb-ad`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-supabase-key': supabaseKey
            },
            body: JSON.stringify(adData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            return { success: true, data: result.data };
        } else {
            return { success: false, error: result.error || 'Unknown error' };
        }

    } catch (error) {
        console.error('Background save error:', error);
        return { success: false, error: error.message };
    }
}
