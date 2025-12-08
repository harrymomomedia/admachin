// Popup script - handles saving ads to AdMachin

const DEFAULT_API_URL = 'https://admachin.vercel.app';

// DOM elements
const statusEl = document.getElementById('status');
const previewSection = document.getElementById('preview-section');
const previewTextEl = document.getElementById('preview-text');
const previewHeadlineEl = document.getElementById('preview-headline');
const previewMediaEl = document.getElementById('preview-media');
const saveBtnEl = document.getElementById('save-btn');
const apiUrlInput = document.getElementById('api-url');
const supabaseKeyInput = document.getElementById('supabase-key');
const saveSettingsBtn = document.getElementById('save-settings');

let extractedData = null;

// Load saved settings
async function loadSettings() {
    const result = await chrome.storage.local.get(['apiUrl', 'supabaseKey']);
    apiUrlInput.value = result.apiUrl || DEFAULT_API_URL;
    supabaseKeyInput.value = result.supabaseKey || '';
}

// Save settings
saveSettingsBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({
        apiUrl: apiUrlInput.value || DEFAULT_API_URL,
        supabaseKey: supabaseKeyInput.value
    });
    showStatus('Settings saved!', 'success');
    setTimeout(() => checkCurrentPage(), 1000);
});

// Show status message
function showStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
}

// Check if current tab is an ad library page
async function checkCurrentPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url.includes('facebook.com/ads/library')) {
            showStatus('Navigate to a Facebook Ad Library page to save ads.', 'warning');
            saveBtnEl.disabled = true;
            return;
        }

        if (!tab.url.includes('id=')) {
            showStatus('Open a specific ad to save it. Look for ?id=... in the URL.', 'warning');
            saveBtnEl.disabled = true;
            return;
        }

        // Check if settings are configured
        const { supabaseKey } = await chrome.storage.local.get(['supabaseKey']);
        if (!supabaseKey) {
            showStatus('Please configure your Supabase anon key in settings below.', 'warning');
            saveBtnEl.disabled = true;
            return;
        }

        // Extract ad data from the page
        showStatus('Extracting ad data...', 'info');

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractAdDataFromPage
        });

        if (results && results[0] && results[0].result) {
            extractedData = results[0].result;
            displayPreview(extractedData);
            showStatus('Ad detected! Click Save to add to your library.', 'success');
            saveBtnEl.disabled = false;
        } else {
            showStatus('Could not extract ad data. Try scrolling to load the ad content.', 'error');
            saveBtnEl.disabled = true;
        }

    } catch (error) {
        console.error('Error checking page:', error);
        showStatus(`Error: ${error.message}`, 'error');
        saveBtnEl.disabled = true;
    }
}

// Display extracted data preview
function displayPreview(data) {
    previewSection.style.display = 'block';

    // Ad text
    if (data.ad_creative_bodies && data.ad_creative_bodies.length > 0) {
        previewTextEl.textContent = data.ad_creative_bodies[0].substring(0, 200) +
            (data.ad_creative_bodies[0].length > 200 ? '...' : '');
        previewTextEl.classList.remove('empty');
    } else {
        previewTextEl.textContent = 'No text detected';
        previewTextEl.classList.add('empty');
    }

    // Headline
    if (data.ad_creative_link_titles && data.ad_creative_link_titles.length > 0) {
        previewHeadlineEl.textContent = data.ad_creative_link_titles[0];
        previewHeadlineEl.classList.remove('empty');
    } else {
        previewHeadlineEl.textContent = 'No headline detected';
        previewHeadlineEl.classList.add('empty');
    }

    // Media
    if (data.media_urls && data.media_urls.length > 0) {
        previewMediaEl.innerHTML = '';
        data.media_urls.slice(0, 3).forEach(media => {
            if (media.type === 'video') {
                const video = document.createElement('video');
                video.src = media.url;
                video.poster = media.poster;
                video.muted = true;
                previewMediaEl.appendChild(video);
            } else {
                const img = document.createElement('img');
                img.src = media.url;
                img.alt = media.alt || 'Ad image';
                previewMediaEl.appendChild(img);
            }
        });
    } else {
        previewMediaEl.innerHTML = '<span class="preview-content empty">No media detected</span>';
    }
}

// Save ad to AdMachin
saveBtnEl.addEventListener('click', async () => {
    if (!extractedData) return;

    saveBtnEl.disabled = true;
    saveBtnEl.innerHTML = '<div class="spinner"></div><span>Saving...</span>';

    try {
        const { apiUrl, supabaseKey } = await chrome.storage.local.get(['apiUrl', 'supabaseKey']);
        const baseUrl = apiUrl || DEFAULT_API_URL;

        const response = await fetch(`${baseUrl}/api/save-fb-ad`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-supabase-key': supabaseKey
            },
            body: JSON.stringify(extractedData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showStatus('Ad saved successfully!', 'success');
            saveBtnEl.innerHTML = '<span>✓ Saved!</span>';

            // Open AdMachin in new tab
            setTimeout(() => {
                chrome.tabs.create({ url: `${baseUrl}/fb-ad-library` });
            }, 1000);
        } else {
            throw new Error(result.error || 'Failed to save ad');
        }

    } catch (error) {
        console.error('Save error:', error);
        showStatus(`Error: ${error.message}`, 'error');
        saveBtnEl.innerHTML = '<span>Save to AdMachin</span>';
        saveBtnEl.disabled = false;
    }
});

// Function that runs in the page context to extract ad data
function extractAdDataFromPage() {
    const data = {
        ad_archive_id: null,
        page_id: null,
        page_name: null,
        ad_creative_bodies: [],
        ad_creative_link_titles: [],
        ad_creative_link_descriptions: [],
        ad_creative_link_captions: [],
        media_urls: [],
        page_profile_picture_url: null,
        publisher_platforms: [],
        ad_delivery_start_time: null,
        url: window.location.href
    };

    try {
        // Extract ad ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        data.ad_archive_id = urlParams.get('id');

        // Look for all text content in specific ad card areas
        // Facebook uses various class patterns, so we search broadly
        const mainContent = document.querySelector('div[role="main"]');
        if (!mainContent) return data;

        // Find page name - often in a strong or heading element
        const pageNameCandidates = mainContent.querySelectorAll('strong, h2 span, a[role="link"] span');
        for (const el of pageNameCandidates) {
            const text = el.textContent?.trim();
            if (text && text.length > 2 && text.length < 100 && !text.includes('Ad Library')) {
                // Check if this looks like a page name (usually first substantial text)
                if (!data.page_name && el.closest('a')) {
                    data.page_name = text;
                    break;
                }
            }
        }

        // Extract all substantial text blocks
        const textBlocks = mainContent.querySelectorAll('div[dir="auto"], span[dir="auto"]');
        textBlocks.forEach(el => {
            const text = el.textContent?.trim();
            // Look for ad copy (substantial text that's not navigation)
            if (text && text.length > 30 && text.length < 5000) {
                const isNavigation = ['Filter', 'Search', 'Ad Library', 'Categories', 'Regions'].some(nav =>
                    text.startsWith(nav)
                );
                if (!isNavigation && !data.ad_creative_bodies.includes(text)) {
                    // Check if this text isn't already contained in another entry
                    const isDuplicate = data.ad_creative_bodies.some(existing =>
                        existing.includes(text) || text.includes(existing)
                    );
                    if (!isDuplicate) {
                        data.ad_creative_bodies.push(text);
                    }
                }
            }
        });

        // Extract headlines - usually shorter, prominent text
        const headlineCandidates = mainContent.querySelectorAll('span[class*="x1lliihq"], div[class*="xzsf02u"]');
        headlineCandidates.forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 5 && text.length < 150) {
                // Headlines are typically standalone, punchy text
                if (!data.ad_creative_link_titles.includes(text) &&
                    !data.ad_creative_bodies.includes(text)) {
                    data.ad_creative_link_titles.push(text);
                }
            }
        });

        // Extract videos
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            let src = video.src;
            if (!src) {
                const source = video.querySelector('source');
                src = source?.src;
            }
            if (src && src.startsWith('http')) {
                data.media_urls.push({
                    type: 'video',
                    url: src,
                    poster: video.poster || null
                });
            }
        });

        // Extract images (filter out small icons)
        const images = mainContent.querySelectorAll('img[src*="scontent"], img[src*="fbcdn"]');
        images.forEach(img => {
            // Use natural dimensions or computed dimensions
            const width = img.naturalWidth || img.width || parseInt(img.style.width) || 0;
            const height = img.naturalHeight || img.height || parseInt(img.style.height) || 0;

            // Filter out small images (icons, avatars)
            if ((width > 100 || height > 100) && img.src) {
                const isDuplicate = data.media_urls.some(m => m.url === img.src);
                if (!isDuplicate) {
                    data.media_urls.push({
                        type: 'image',
                        url: img.src,
                        alt: img.alt || null
                    });
                }
            }
        });

        // Try to find profile picture
        const profilePics = mainContent.querySelectorAll('img[alt*="profile"], svg image');
        for (const pic of profilePics) {
            const src = pic.src || pic.getAttribute('xlink:href');
            if (src) {
                data.page_profile_picture_url = src;
                break;
            }
        }

        // Detect platforms
        const pageText = mainContent.textContent || '';
        if (pageText.includes('Facebook')) data.publisher_platforms.push('facebook');
        if (pageText.includes('Instagram')) data.publisher_platforms.push('instagram');
        if (pageText.includes('Messenger')) data.publisher_platforms.push('messenger');

        // Try to find date
        const dateMatch = pageText.match(/Started running on ([A-Za-z]+ \d+, \d{4})/);
        if (dateMatch) {
            data.ad_delivery_start_time = dateMatch[1];
        }

    } catch (error) {
        console.error('AdMachin extraction error:', error);
    }

    return data;
}

// Initialize
loadSettings();
checkCurrentPage();
