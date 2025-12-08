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
                const idMatch = container.innerText.match(/Library ID:?\s*(\d+)/);
                if (idMatch) {
                    data.ad_archive_id = idMatch[1];
                }
            } else {
                const urlParams = new URLSearchParams(window.location.search);
                data.ad_archive_id = urlParams.get('id');
            }

            // --- BLOCK-LEVEL TEXT EXTRACTION ---
            // Instead of TreeWalker (which fragments text), use innerText on block elements

            // 1. PAGE NAME - Usually bold/strong near top
            const strongElements = container.querySelectorAll('strong, b, [style*="font-weight: 600"], [style*="font-weight: 700"]');
            for (const el of strongElements) {
                const text = el.innerText?.trim();
                if (text && text.length > 2 && text.length < 50 &&
                    !text.includes('Sponsored') && !text.includes('Library ID') && !text.includes('Active')) {
                    data.page_name = text;
                    break;
                }
            }
            // Fallback: First link text
            if (!data.page_name) {
                const firstLink = container.querySelector('a[role="link"]');
                if (firstLink) {
                    const linkText = firstLink.innerText?.trim();
                    if (linkText && linkText.length < 50) data.page_name = linkText;
                }
            }

            // 2. AD BODY - Look for div[dir="auto"] with substantial text
            // These are the main text containers Facebook uses
            const textBlocks = container.querySelectorAll('div[dir="auto"], span[dir="auto"]');
            const potentialBodies = [];

            textBlocks.forEach(el => {
                const text = el.innerText?.trim();
                if (!text || text.length < 20) return;

                // Skip known UI elements
                const isNoise = [
                    'Sponsored', 'Active', 'Inactive', 'Library ID', 'Platforms',
                    'Categories', 'See ad details', 'See details', 'Ad Details',
                    'Learn more', 'Shop Now', 'Sign Up', 'Get Quote', 'Apply Now',
                    'Started running', 'This ad has'
                ].some(noise => text.startsWith(noise) || text === noise);

                if (!isNoise) {
                    potentialBodies.push({ text, length: text.length });
                }
            });

            // Sort by length (longest first = main ad copy)
            potentialBodies.sort((a, b) => b.length - a.length);

            // Take unique bodies, avoiding substrings
            potentialBodies.forEach(item => {
                const isDupe = data.ad_creative_bodies.some(existing =>
                    existing.includes(item.text) || item.text.includes(existing)
                );
                if (!isDupe && data.ad_creative_bodies.length < 3) {
                    data.ad_creative_bodies.push(item.text);
                }
            });

            // 3. HEADLINE - Usually short text near bottom, above CTA
            // Look for text that's NOT in the body, relatively short, often bold or in a link
            const allTextElements = container.querySelectorAll('span, div');
            const bottomElements = Array.from(allTextElements).slice(-30); // Focus on bottom

            for (const el of bottomElements) {
                const text = el.innerText?.trim();
                if (!text || text.length < 10 || text.length > 100) continue;

                // Skip if it's part of the body
                const inBody = data.ad_creative_bodies.some(b => b.includes(text));
                if (inBody) continue;

                // Skip known CTA/UI text
                const isCTA = ['Learn more', 'Shop Now', 'Sign Up', 'Get Quote', 'Apply Now',
                    'Download', 'Contact Us', 'Book Now', 'Subscribe', 'Sponsored',
                    'See ad details', 'Library ID'].some(cta => text.includes(cta));
                if (isCTA) continue;

                // Check if it looks like a headline (contains alphanumeric, not just symbols)
                if (/[a-zA-Z]{3,}/.test(text)) {
                    data.ad_creative_link_titles.push(text);
                    if (data.ad_creative_link_titles.length >= 2) break;
                }
            }


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
            btn.innerHTML = 'Saving...';
            btn.style.background = '#9333ea';

            // Use already extracted data
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

            chrome.runtime.sendMessage({
                action: 'saveAd',
                data: adData
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
