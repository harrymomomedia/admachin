// Background service worker for the extension

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'saveAd') {
        handleSaveAd(message.data).then(sendResponse);
        return true; // Keep the message channel open for async response
    }
});

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
