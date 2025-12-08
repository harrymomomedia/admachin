// Content script that runs on Facebook Ad Library pages
// Extracts ad data from the rendered DOM

(function () {
    'use strict';

    // Configuration - update this to your AdMachin app URL
    const ADMACHIN_API_URL = 'https://admachin.vercel.app/api/save-fb-ad';

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
                // If we are scraping a card, we must find the ID in the text
                // Look for "Library ID: 123456789"
                const idMatch = container.innerText.match(/Library ID:?\s*(\d+)/);
                if (idMatch) {
                    data.ad_archive_id = idMatch[1];
                }
            } else {
                // Fallback to URL for single view
                const urlParams = new URLSearchParams(window.location.search);
                data.ad_archive_id = urlParams.get('id');
            }


            // --- BRUTE FORCE TEXT EXTRACTION ---
            const walker = document.createTreeWalker(
                container,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function (node) {
                        const tag = node.parentElement.tagName;
                        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'BUTTON') return NodeFilter.FILTER_REJECT;
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

                const isNoise = [
                    'Ad Library', 'Sponsored', 'Filter', 'Sort', 'Search', 'Active', 'Inactive',
                    'See details', 'About', 'Library ID', 'Platforms', 'Categories', 'Get Quote',
                    'Learn more', 'Sign Up', 'Apply Now', 'Download', 'Contact Us', 'Shop Now',
                    'Save to AdMachin', 'Saved!', 'Error'
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

            // 1. Page Name
            const nameCandidates = textCandidates.filter(c => c.length > 2 && c.length < 50);
            for (const c of nameCandidates) {
                const isBold = c.weight === '600' || c.weight === '700' || c.weight === 'bold' || c.tag === 'STRONG' || c.tag === 'B';
                if (isBold && !data.page_name) {
                    data.page_name = c.text;
                    break;
                }
            }
            if (!data.page_name && nameCandidates.length > 0) {
                const firstClean = nameCandidates.find(c => !c.text.includes(':') && !c.text.match(/^\d+$/));
                if (firstClean) data.page_name = firstClean.text;
            }

            // 2. Ad Bodies
            const potentialBodies = textCandidates.filter(c => c.length > 30);
            potentialBodies.sort((a, b) => b.length - a.length);

            potentialBodies.forEach(c => {
                if (!data.ad_creative_bodies.includes(c.text)) {
                    const isSubstring = data.ad_creative_bodies.some(body => body.includes(c.text));
                    if (!isSubstring) {
                        data.ad_creative_bodies.push(c.text);
                    }
                }
            });

            // 3. Headlines
            const potentialHeadlines = textCandidates.filter(c => c.length > 5 && c.length < 100);
            potentialHeadlines.forEach(c => {
                const inBody = data.ad_creative_bodies.some(b => b.includes(c.text));
                const isPageName = c.text === data.page_name;

                if (!inBody && !isPageName && !data.ad_creative_link_titles.includes(c.text)) {
                    const isBold = c.weight === '600' || c.weight === '700' || c.weight === 'bold' || c.tag === 'STRONG' || c.tag === 'H3';
                    if (isBold) {
                        data.ad_creative_link_titles.push(c.text);
                    }
                }
            });


            // --- MEDIA EXTRACTION ---
            const videos = container.querySelectorAll('video');
            videos.forEach(video => {
                let src = video.src || video.querySelector('source')?.src;
                if (src) {
                    data.media_urls.push({ type: 'video', url: src, poster: video.poster || null });
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

        // Ensure card is relative so we can position if needed, 
        // though appending to bottom is safer
        if (window.getComputedStyle(card).position === 'static') {
            card.style.position = 'relative';
        }

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

        // Styling
        btn.style.cssText = `
            position: absolute;
            bottom: 12px;
            right: 12px;
            z-index: 1000;
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
            e.stopPropagation(); // Prevent opening the ad detail
            e.preventDefault();

            btn.disabled = true;
            btn.innerHTML = 'Converting...';
            btn.style.background = '#9333ea'; // Purple for working

            const adData = extractAdData(card);

            if (!adData.ad_archive_id) {
                btn.innerHTML = 'No ID Found';
                btn.style.background = '#ef4444';
                setTimeout(() => {
                    btn.innerHTML = 'Save';
                    btn.style.background = '#2563eb';
                    btn.disabled = false;
                }, 2000);
                return;
            }

            btn.innerHTML = 'Saving...';

            chrome.runtime.sendMessage({
                action: 'saveAd',
                data: adData
            }, (response) => {
                if (response?.success) {
                    btn.innerHTML = '✓ Saved';
                    btn.style.background = '#10b981'; // Green
                } else {
                    btn.innerHTML = 'Error';
                    btn.style.background = '#ef4444'; // Red
                    console.error('Save failed:', response);
                }

                setTimeout(() => {
                    if (btn.innerText === '✓ Saved') {
                        btn.innerHTML = 'Saved';
                        // keep green
                    } else {
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
                }, 2000);
            });
        };

        card.appendChild(btn);
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
