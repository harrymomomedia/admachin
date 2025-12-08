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
        const urlParams = new URLSearchParams(window.location.search);
        data.ad_archive_id = urlParams.get('id');

        // IDENTIFY CONTAINER
        // First try dialog, then main, then body
        let container = document.querySelector('div[role="dialog"]');
        if (!container) container = document.querySelector('div[role="main"]');
        if (!container) container = document.body;

        if (!container) return data;

        // --- BRUTE FORCE TEXT EXTRACTION ---
        // Instead of specific selectors, we find ALL distinct text blocks
        // and filter them based on heuristics (length, content).
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    // Skip hidden/script/style
                    const tag = node.parentElement.tagName;
                    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
                    if (node.textContent.trim().length < 2) return NodeFilter.FILTER_SKIP;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node;
        const textCandidates = [];
        while (node = walker.nextNode()) {
            const text = node.textContent.trim();
            const parent = node.parentElement;

            // Check visibility rough guess (non-zero width/height)
            // This isn't perfect in an extension background script but usually works
            // Note: getBoundingClientRect might not work if tab is backgrounded, but usually user is on tab.

            // Filter out known UI noise strings
            const isNoise = [
                'Ad Library', 'Sponsored', 'Filter', 'Sort', 'Search', 'Active', 'Inactive',
                'See details', 'About', 'Library ID', 'Platforms', 'Categories', 'Get Quote',
                'Learn more', 'Sign Up', 'Apply Now', 'Download', 'Contact Us', 'Shop Now'
            ].some(noise => text === noise || text.startsWith(noise + ':'));

            if (!isNoise) {
                textCandidates.push({
                    text,
                    length: text.length,
                    tag: parent.tagName,
                    weight: window.getComputedStyle(parent).fontWeight
                });
            }
        }

        // --- PROCESS TEXT CANDIDATES ---

        // 1. Page Name: usually short, bold/strong, or H2/H3
        // We look for the first "likely" page name candidate
        const nameCandidates = textCandidates.filter(c => c.length > 2 && c.length < 50);
        for (const c of nameCandidates) {
            // Priority to bold text or headers
            const isBold = c.weight === '600' || c.weight === '700' || c.weight === 'bold' || c.tag === 'STRONG' || c.tag === 'B';
            if (isBold && !data.page_name) {
                // Heuristic: Page name often appears before "Sponsored"
                data.page_name = c.text;
                break;
            }
        }
        // Fallback for page name if not found: just take first generic candidate that isn't ID
        if (!data.page_name && nameCandidates.length > 0) {
            const firstClean = nameCandidates.find(c => !c.text.includes(':') && !c.text.match(/^\d+$/));
            if (firstClean) data.page_name = firstClean.text;
        }


        // 2. Ad Bodies: The detected text blocks that are substantial
        const potentialBodies = textCandidates.filter(c => c.length > 30);
        // Sort by length desc
        potentialBodies.sort((a, b) => b.length - a.length);

        potentialBodies.forEach(c => {
            if (!data.ad_creative_bodies.includes(c.text)) {
                // Check if contained in another longer body (dedupe)
                const isSubstring = data.ad_creative_bodies.some(body => body.includes(c.text));
                if (!isSubstring) {
                    data.ad_creative_bodies.push(c.text);
                }
            }
        });

        // 3. Headlines: Short, punchy text that didn't make it into bodies
        // Often between 5-100 chars
        const potentialHeadlines = textCandidates.filter(c => c.length > 5 && c.length < 100);
        potentialHeadlines.forEach(c => {
            const inBody = data.ad_creative_bodies.some(b => b.includes(c.text));
            const isPageName = c.text === data.page_name;

            if (!inBody && !isPageName && !data.ad_creative_link_titles.includes(c.text)) {
                // Favor bold text for headlines
                const isBold = c.weight === '600' || c.weight === '700' || c.weight === 'bold' || c.tag === 'STRONG' || c.tag === 'H3';
                // Or if it's just a clean standalone string
                if (isBold) {
                    data.ad_creative_link_titles.push(c.text);
                }
            }
        });


        // --- MEDIA EXTRACTION ---
        // Grab ALL videos
        const videos = container.querySelectorAll('video');
        videos.forEach(video => {
            let src = video.src || video.querySelector('source')?.src;
            if (src) {
                data.media_urls.push({ type: 'video', url: src, poster: video.poster || null });
            }
        });

        // Grab ALL images > specific size
        const images = container.querySelectorAll('img');
        images.forEach(img => {
            // Must have src
            if (!img.src) return;

            // Skip tiny tracking pixels or icons
            // If natural dimensions are 0 (not loaded), we check defined dimensions
            const width = img.naturalWidth || img.width || 0;
            const height = img.naturalHeight || img.height || 0;

            // Ad images are generally substantial
            // Square (1080x1080) or Landscape (1200x628) or Portrait
            // Let's say min 200px
            if (width > 150 || height > 150) {
                // Avoid profile pics if we can identify them (usually < 200, but some overlap)
                // Profile pics often in circular containers or have 'profile' in alt
                const isProfile = (img.alt && img.alt.toLowerCase().includes('profile'));

                if (!isProfile) {
                    if (!data.media_urls.some(m => m.url === img.src)) {
                        data.media_urls.push({ type: 'image', url: img.src, alt: img.alt });
                    }
                } else {
                    // Save as profile pic
                    data.page_profile_picture_url = img.src;
                }
            }
        });

        // --- PLATFORMS & DATES ---
        const fullText = container.innerText || '';
        if (fullText.includes('Facebook')) data.publisher_platforms.push('facebook');
        if (fullText.includes('Instagram')) data.publisher_platforms.push('instagram');

        const dateMatch = fullText.match(/Started running on ([A-Za-z]+ \d+, \d{4})/);
        if (dateMatch) data.ad_delivery_start_time = dateMatch[1];


    } catch (error) {
        console.error('AdMachin extraction error:', error);
    }

    return data;
}

// Initialize
loadSettings();
checkCurrentPage();
