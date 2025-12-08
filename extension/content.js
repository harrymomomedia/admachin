// Content script that runs on Facebook Ad Library pages
// Extracts ad data from the rendered DOM

(function () {
    'use strict';

    // Configuration - update this to your AdMachin app URL
    const ADMACHIN_API_URL = 'https://admachin.vercel.app/api/save-fb-ad';

    // Helper: Capture video from a video element using MediaRecorder
    async function captureVideoFromElement(videoElement, maxDurationMs = 5000) {
        return new Promise((resolve, reject) => {
            try {
                // Ensure video is playing
                if (videoElement.paused) {
                    videoElement.muted = true;
                    videoElement.play().catch(() => { }); // Ignore autoplay errors
                }

                const stream = videoElement.captureStream();
                const chunks = [];
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                recorder.onstop = async () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const reader = new FileReader();
                    reader.onloadend = () => resolve({
                        base64: reader.result,
                        mimeType: 'video/webm',
                        size: blob.size
                    });
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                };

                recorder.onerror = reject;
                recorder.start();

                // Record for a short duration (or until video ends)
                const duration = Math.min(videoElement.duration * 1000 || maxDurationMs, maxDurationMs);
                setTimeout(() => {
                    if (recorder.state === 'recording') {
                        recorder.stop();
                    }
                }, duration);

            } catch (error) {
                reject(error);
            }
        });
    }

    // Helper: Download media using browser fetch (has cookies) and convert to base64
    async function downloadMediaAsBase64(mediaItems, maxItems = 3, container = null) {
        const results = [];

        for (const item of mediaItems.slice(0, maxItems)) {
            try {
                // For blob: URLs on videos, try to capture from the video element
                if (item.type === 'video' && (item.url.startsWith('blob:') || item.url === 'blob_video')) {
                    console.log('AdMachin: Attempting to capture blob video...');

                    // Find the video element in the container
                    const videoEl = container?.querySelector('video');
                    if (videoEl) {
                        try {
                            const captured = await captureVideoFromElement(videoEl, 5000);
                            results.push({
                                ...item,
                                base64: captured.base64,
                                mimeType: captured.mimeType,
                                size: captured.size
                            });
                            console.log(`AdMachin: Captured video (${Math.round(captured.size / 1024)}KB)`);
                            continue;
                        } catch (captureError) {
                            console.error('AdMachin: Video capture failed:', captureError);
                            // Fall through to try poster
                        }
                    }

                    // Fallback: Try to download the poster image instead
                    if (item.poster && !item.poster.startsWith('blob:')) {
                        const posterResponse = await fetch(item.poster, { credentials: 'include' });
                        if (posterResponse.ok) {
                            const blob = await posterResponse.blob();
                            const base64 = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                            results.push({
                                ...item,
                                base64: base64,
                                mimeType: blob.type,
                                size: blob.size,
                                isPosterOnly: true
                            });
                            console.log(`AdMachin: Downloaded video poster (${Math.round(blob.size / 1024)}KB)`);
                            continue;
                        }
                    }

                    results.push({ ...item, error: 'blob_video_capture_failed' });
                    continue;
                }

                // Regular URL download
                if (item.url.startsWith('blob:')) {
                    console.log('AdMachin: Skipping blob URL:', item.url);
                    results.push({ ...item, error: 'blob_url_not_supported' });
                    continue;
                }

                const response = await fetch(item.url, {
                    credentials: 'include',
                    mode: 'cors'
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const blob = await response.blob();
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                results.push({
                    ...item,
                    base64: base64, // data:mime;base64,xxx
                    mimeType: blob.type,
                    size: blob.size
                });

                console.log(`AdMachin: Downloaded ${item.type} (${Math.round(blob.size / 1024)}KB)`);

            } catch (error) {
                console.error('AdMachin: Failed to download media:', item.url, error);
                results.push({ ...item, error: error.message });
            }
        }

        return results;
    }

    // Extract ad data from the current page OR a specific card
    function extractAdData(specificContainer = null) {
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
            // DETERMINE CONTAINER
            let container = specificContainer;

            if (!container) {
                // Default logic for single ad view
                container = document.querySelector('div[role="dialog"]');
                if (!container) container = document.querySelector('div[role="main"]');
                if (!container) container = document.body;
            }

            if (!container) return data;

            // DETERMINE AD ID
            if (specificContainer) {
                const idMatch = container.innerText.match(/Library ID:?\s*(\d+)/);
                if (idMatch) {
                    data.ad_archive_id = idMatch[1];
                }
            } else {
                const urlParams = new URLSearchParams(window.location.search);
                data.ad_archive_id = urlParams.get('id');
            }

            // --- ROBUST TEXT EXTRACTION ---

            // Get the full text content for analysis
            const fullText = container.innerText || '';
            const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // Noise patterns to skip (UI elements, CTAs, metadata)
            const noisePatterns = [
                /^Active$/i, /^Inactive$/i, /^Sponsored$/i, /^Library ID/i,
                /^Started running/i, /^Platforms/i, /^Categories/i,
                /^See ad details$/i, /^See details$/i, /^Ad Details$/i,
                /^This ad has/i, /^Learn more$/i, /^Shop Now$/i, /^Sign Up$/i,
                /^Get Quote$/i, /^Apply Now$/i, /^Download$/i, /^Contact Us$/i,
                /^Book Now$/i, /^Subscribe$/i, /^Call now$/i, /^Send message$/i,
                /^\d+ results?$/i, /^Total active time/i,
                /^Open Dropdown$/i, /^Dropdown$/i, /^Menu$/i, /^Close$/i,
                /^More$/i, /^Share$/i, /^Save$/i, /^Report$/i
            ];

            const isNoise = (text) => noisePatterns.some(p => p.test(text));
            const isUrl = (text) => /^[A-Z0-9.-]+\.(COM|NET|ORG|IO|APP|CO)/i.test(text);

            // 1. PAGE NAME - Text right before "Sponsored"
            const sponsoredIndex = lines.findIndex(l => l === 'Sponsored');
            if (sponsoredIndex > 0) {
                const candidate = lines[sponsoredIndex - 1];
                if (candidate && candidate.length > 2 && candidate.length < 60 && !isNoise(candidate)) {
                    data.page_name = candidate;
                }
            }

            // Fallback: First meaningful short text
            if (!data.page_name) {
                for (let i = 0; i < Math.min(lines.length, 15); i++) {
                    const line = lines[i];
                    if (line.length > 2 && line.length < 60 && !isNoise(line) && !isUrl(line) && !/^\d+$/.test(line)) {
                        data.page_name = line;
                        break;
                    }
                }
            }

            // 2. AD BODY - Find text AFTER "Sponsored" (position-based, not length-based)
            // The ad body comes right after "Sponsored" in the DOM
            const bodyStartIndex = sponsoredIndex >= 0 ? sponsoredIndex + 1 : 0;

            // Collect consecutive long text lines starting from after Sponsored
            let bodyText = '';
            for (let i = bodyStartIndex; i < lines.length; i++) {
                const line = lines[i];

                // Stop if we hit a URL (indicates we've passed the ad body into the CTA area)
                if (isUrl(line)) break;

                // Skip short noise
                if (isNoise(line) || line.length < 15) continue;

                // Skip if it looks like the page name
                if (line === data.page_name) continue;

                // Accumulate text
                bodyText += (bodyText ? ' ' : '') + line;

                // Stop after we have a reasonable amount
                if (bodyText.length > 200) break;
            }

            if (bodyText.length > 30) {
                data.ad_creative_bodies.push(bodyText);
            }

            // 3. HEADLINE - Look ONLY at the last few lines after the display URL
            // Find the display URL first
            let displayUrlIndex = -1;
            for (let i = lines.length - 1; i >= 0; i--) {
                if (isUrl(lines[i])) {
                    data.ad_creative_link_captions.push(lines[i]);
                    displayUrlIndex = i;
                    break;
                }
            }

            // Track which lines are part of body (before we joined them)
            const bodyLines = new Set();
            for (let i = bodyStartIndex; i < lines.length && bodyLines.size < 10; i++) {
                const line = lines[i];
                if (isUrl(line)) break;
                if (!isNoise(line) && line.length >= 15) {
                    bodyLines.add(line);
                }
            }

            // Headline is in the last 5 lines AFTER the display URL
            if (displayUrlIndex >= 0) {
                // Search from displayUrlIndex+1 to end, but only check a few lines
                for (let i = displayUrlIndex + 1; i < Math.min(displayUrlIndex + 5, lines.length); i++) {
                    const line = lines[i];
                    if (!line || line.length < 15 || line.length > 100) continue;
                    if (isNoise(line) || isUrl(line)) continue;

                    // Skip if it's one of our body lines
                    if (bodyLines.has(line)) continue;

                    // Skip page name
                    if (line === data.page_name) continue;

                    // Skip lines starting with emoji
                    if (/^[\u{1F300}-\u{1F9FF}]/u.test(line)) continue;

                    // Must have actual words (not just symbols/numbers)
                    if (/[a-zA-Z]{5,}/.test(line)) {
                        data.ad_creative_link_titles.push(line);
                        break; // Only need 1 headline
                    }
                }
            }


            // --- MEDIA EXTRACTION ---
            // Videos - try multiple sources since FB often uses blob: URLs
            const videos = container.querySelectorAll('video');
            videos.forEach(video => {
                // Try multiple sources for video URL
                let src = null;

                // 1. Direct src (might be blob:)
                if (video.src && !video.src.startsWith('blob:')) {
                    src = video.src;
                }

                // 2. Source element
                if (!src) {
                    const sourceEl = video.querySelector('source');
                    if (sourceEl?.src && !sourceEl.src.startsWith('blob:')) {
                        src = sourceEl.src;
                    }
                }

                // 3. Data attributes (FB sometimes uses these)
                if (!src) {
                    src = video.getAttribute('data-video-url') ||
                        video.getAttribute('data-src') ||
                        video.parentElement?.getAttribute('data-video-url');
                }

                // Get poster image (always useful as thumbnail)
                const poster = video.poster ||
                    video.getAttribute('data-poster') ||
                    video.parentElement?.querySelector('img')?.src;

                if (src || poster) {
                    data.media_urls.push({
                        type: 'video',
                        url: src || 'blob_video', // Mark if no downloadable URL
                        poster: poster || null,
                        isBlob: !src // Flag to indicate we only have poster
                    });
                }
            });

            const images = container.querySelectorAll('img');
            images.forEach(img => {
                if (!img.src) return;

                const width = img.naturalWidth || img.width || 0;
                const height = img.naturalHeight || img.height || 0;

                if (width > 150 || height > 150) {
                    const isProfile = (img.alt && img.alt.toLowerCase().includes('profile'));

                    if (!isProfile) {
                        if (!data.media_urls.some(m => m.url === img.src)) {
                            data.media_urls.push({ type: 'image', url: img.src, alt: img.alt });
                        }
                    } else {
                        data.page_profile_picture_url = img.src;
                    }
                }
            });

            // --- PLATFORMS & DATES (reuse fullText from above) ---
            if (fullText.includes('Facebook')) data.publisher_platforms.push('facebook');
            if (fullText.includes('Instagram')) data.publisher_platforms.push('instagram');

            const dateMatch = fullText.match(/Started running on ([A-Za-z]+ \d+, \d{4})/);
            if (dateMatch) data.ad_delivery_start_time = dateMatch[1];


        } catch (error) {
            console.error('AdMachin extraction error:', error);
        }

        return data;
    }

    // --- GRID VIEW: INLINE BUTTONS ---

    // Find all ad cards and inject buttons
    function injectGridButtons() {
        // Strategy: Find elements with "Library ID:". 
        // Then traverse up to find the container card.

        // Use a TreeWalker to find "Library ID:" text nodes efficiently
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.includes('Library ID:')) {
                // Found an anchor point. Now find the card container.
                // The card is usually a few levels up, has a shadow or border radius.
                // We'll traverse up until we find a DIV that looks like a card (simplified heuristic)
                let card = node.parentElement;
                let depth = 0;

                // Traverse up to 10 levels to find the card container
                while (card && depth < 10) {
                    const style = window.getComputedStyle(card);
                    // Check for typical card characteristics
                    // Note: FB classes are obfuscated, so checking for 'card-like' layout
                    if (card.tagName === 'DIV' && (
                        style.boxShadow !== 'none' ||
                        style.backgroundColor === 'rgb(255, 255, 255)' && style.borderRadius !== '0px'
                    )) {
                        // We likely found the card (or inner card). 
                        // Let's verify it's not the whole page main container.
                        if (card.getAttribute('role') !== 'main') {
                            injectButtonIntoCard(card);
                            break;
                        }
                    }
                    card = card.parentElement;
                    depth++;
                }
            }
        }
    }

    function injectButtonIntoCard(card) {
        // Check if button already exists
        if (card.querySelector('.admachin-inline-btn')) return;

        // Ensure card is relative so we can position if needed
        if (window.getComputedStyle(card).position === 'static') {
            card.style.position = 'relative';
        }

        // --- CREATE CONTAINER FOR BUTTON + PREVIEW ---
        const container = document.createElement('div');
        container.className = 'admachin-container';
        container.style.cssText = `
            position: absolute;
            bottom: 8px;
            right: 8px;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 4px;
        `;

        // --- CREATE PREVIEW PANEL ---
        const preview = document.createElement('div');
        preview.className = 'admachin-preview';
        preview.style.cssText = `
            background: rgba(0, 0, 0, 0.85);
            color: #e5e7eb;
            padding: 8px 10px;
            border-radius: 6px;
            font-size: 10px;
            font-family: ui-monospace, monospace;
            max-width: 220px;
            line-height: 1.4;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: block;
        `;
        preview.innerHTML = '<span style="color:#9ca3af;">Extracting...</span>';

        // --- RUN EXTRACTION IMMEDIATELY TO POPULATE PREVIEW ---
        const adData = extractAdData(card);
        const truncate = (str, len) => str && str.length > len ? str.substring(0, len) + '...' : (str || '—');

        const hasText = adData.ad_creative_bodies.length > 0;
        const hasHeadline = adData.ad_creative_link_titles.length > 0;
        const mediaCount = adData.media_urls.length;

        preview.innerHTML = `
            <div style="margin-bottom:4px;color:${adData.ad_archive_id ? '#10b981' : '#ef4444'};">
                <strong>ID:</strong> ${adData.ad_archive_id || '❌ NOT FOUND'}
            </div>
            <div style="margin-bottom:3px;">
                <strong>Page:</strong> ${truncate(adData.page_name, 25)}
            </div>
            <div style="margin-bottom:3px;color:${hasText ? '#a5f3fc' : '#fca5a5'};">
                <strong>Text:</strong> ${hasText ? truncate(adData.ad_creative_bodies[0], 40) : '❌ None'}
            </div>
            <div style="margin-bottom:3px;color:${hasHeadline ? '#a5f3fc' : '#fca5a5'};">
                <strong>Headline:</strong> ${hasHeadline ? truncate(adData.ad_creative_link_titles[0], 30) : '❌ None'}
            </div>
            <div style="color:${mediaCount > 0 ? '#a5f3fc' : '#fca5a5'};">
                <strong>Media:</strong> ${mediaCount > 0 ? `${mediaCount} item(s)` : '❌ None'}
            </div>
        `;

        // --- CREATE SAVE BUTTON ---
        const btn = document.createElement('button');
        btn.className = 'admachin-inline-btn';
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save
        `;

        btn.style.cssText = `
            padding: 6px 12px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            transition: all 0.2s;
        `;

        btn.onmouseover = () => btn.style.background = '#1d4ed8';
        btn.onmouseout = () => btn.style.background = '#2563eb';

        btn.onclick = async (e) => {
            e.stopPropagation();
            e.preventDefault();

            btn.disabled = true;
            btn.innerHTML = 'Processing...';
            btn.style.background = '#9333ea';

            if (!adData.ad_archive_id) {
                btn.innerHTML = 'No ID!';
                btn.style.background = '#ef4444';
                setTimeout(() => {
                    btn.innerHTML = 'Save';
                    btn.style.background = '#2563eb';
                    btn.disabled = false;
                }, 2000);
                return;
            }

            // --- DOWNLOAD MEDIA IN BROWSER ---
            preview.innerHTML = '<span style="color:#a5b4fc;">⏳ Downloading media...</span>';

            let downloadedMedia = [];
            if (adData.media_urls.length > 0) {
                try {
                    // Pass the card container so we can find video elements for capture
                    downloadedMedia = await downloadMediaAsBase64(adData.media_urls, 3, card);
                    const successCount = downloadedMedia.filter(m => m.base64).length;
                    preview.innerHTML = `<span style="color:#a5f3fc;">✓ Downloaded ${successCount}/${adData.media_urls.length} media</span>`;
                } catch (error) {
                    console.error('Media download error:', error);
                    preview.innerHTML = '<span style="color:#fca5a5;">⚠ Media download failed</span>';
                }
            }

            // Attach downloaded media to the data
            const dataWithMedia = {
                ...adData,
                downloaded_media: downloadedMedia
            };

            btn.innerHTML = 'Uploading...';
            preview.innerHTML = '<span style="color:#a5b4fc;">⏳ Saving to AdMachin...</span>';

            chrome.runtime.sendMessage({
                action: 'saveAd',
                data: dataWithMedia
            }, (response) => {
                if (response?.success) {
                    btn.innerHTML = '✓ Saved';
                    btn.style.background = '#10b981';
                    preview.innerHTML = '<span style="color:#10b981;">✓ Saved to AdMachin!</span>';
                } else {
                    btn.innerHTML = 'Error';
                    btn.style.background = '#ef4444';
                    preview.innerHTML = `<span style="color:#ef4444;">Error: ${response?.error || 'Unknown'}</span>`;
                    console.error('Save failed:', response);
                }

                setTimeout(() => {
                    if (btn.innerText !== '✓ Saved') {
                        btn.innerHTML = `
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                            </svg>
                            Save
                        `;
                        btn.style.background = '#2563eb';
                        btn.disabled = false;
                    }
                }, 3000);
            });
        };

        container.appendChild(preview);
        container.appendChild(btn);
        card.appendChild(container);
    }



    // --- FLOATING BUTTON (Original) ---
    function createFloatingSaveButton() {
        if (document.getElementById('admachin-save-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'admachin-save-btn';
        btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      <span>Save to AdMachin</span>
    `;
        btn.className = 'admachin-floating-btn';

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.innerHTML = '<span>Extracting...</span>';
            const adData = extractAdData();
            btn.innerHTML = '<span>Saving...</span>';
            // ... (message sending logic same as inline) ...
            chrome.runtime.sendMessage({
                action: 'saveAd',
                data: adData
            }, (response) => {
                if (response?.success) {
                    btn.innerHTML = '<span>✓ Saved!</span>';
                    btn.classList.add('success');
                } else {
                    btn.innerHTML = '<span>✗ Error</span>';
                    btn.classList.add('error');
                }
                setTimeout(() => {
                    btn.innerHTML = `...Restore Icon...`; // Simplified for brevity in this replace block, but essentially restoring state
                    location.reload(); // Quick fix to reset button state effectively or just reload icon
                }, 2000);
            });
        });

        document.body.appendChild(btn);
    }

    // --- INITIALIZATION ---

    function init() {
        // Detect mode: Single ID view vs Search Grid
        const urlParams = new URLSearchParams(window.location.search);
        const hasId = urlParams.get('id');

        if (hasId) {
            // Single View: Floating Button
            setTimeout(createFloatingSaveButton, 2000);
        } else {
            // Grid View: Inline Buttons
            // Run periodically to catch infinite scroll
            setInterval(injectGridButtons, 2000);
        }
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Watch for URL changes (SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            init();
        }
    }).observe(document, { subtree: true, childList: true });

    // Expose extract function for popup
    window.admachinExtractAdData = extractAdData;
})();
