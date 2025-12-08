// Content script that runs on Facebook Ad Library pages
// Extracts ad data from the rendered DOM

(function () {
    'use strict';

    // Configuration - update this to your AdMachin app URL
    const ADMACHIN_API_URL = 'https://admachin.vercel.app/api/save-fb-ad';

    // Extract ad data from the current page
    function extractAdData() {
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

            // Find the main ad container
            // Facebook's DOM structure varies, so we look for common patterns

            // Extract page name - usually in a link near the top of the ad
            const pageNameSelectors = [
                '[aria-label*="Page"] span',
                'a[href*="/ads/library/?active_status"] + div span',
                'div[role="main"] h2 span',
                'div[data-visualcompletion="ignore-dynamic"] span strong'
            ];

            for (const selector of pageNameSelectors) {
                const el = document.querySelector(selector);
                if (el && el.textContent.trim()) {
                    data.page_name = el.textContent.trim();
                    break;
                }
            }

            // Try to find page profile picture
            const profilePicSelectors = [
                'img[alt*="profile picture"]',
                'svg[aria-label*="profile"] image',
                'div[role="main"] img[src*="scontent"]'
            ];

            for (const selector of profilePicSelectors) {
                const el = document.querySelector(selector);
                if (el) {
                    data.page_profile_picture_url = el.src || el.getAttribute('xlink:href');
                    if (data.page_profile_picture_url) break;
                }
            }

            // Extract ad text/body - look for text content in the ad creative area
            const textSelectors = [
                'div[data-ad-preview="message"]',
                'div[data-ad-comet-preview="message"]',
                'div[class*="x1cy8zhl"]', // Common FB class for ad text
                'div[dir="auto"][style*="webkit-line-clamp"]'
            ];

            // Also try to find all text blocks in the ad area
            const adContainers = document.querySelectorAll('div[role="main"] div[class*="x9f619"]');
            adContainers.forEach(container => {
                // Look for substantial text content (more than just a button label)
                const textContent = container.textContent?.trim();
                if (textContent && textContent.length > 50 && !data.ad_creative_bodies.includes(textContent)) {
                    // Check if this looks like ad copy (not navigation text)
                    if (!textContent.includes('Ad Library') && !textContent.includes('Filters')) {
                        data.ad_creative_bodies.push(textContent);
                    }
                }
            });

            // Extract headline/link titles
            const headlineSelectors = [
                'div[data-ad-preview="headline"]',
                'span[class*="x1lliihq"][class*="x193iq5w"]',
                'div[role="main"] h3'
            ];

            for (const selector of headlineSelectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    const text = el.textContent?.trim();
                    if (text && text.length > 3 && text.length < 200 && !data.ad_creative_link_titles.includes(text)) {
                        data.ad_creative_link_titles.push(text);
                    }
                });
            }

            // Extract video URLs
            const videos = document.querySelectorAll('video');
            videos.forEach(video => {
                const src = video.src || video.querySelector('source')?.src;
                if (src && !data.media_urls.includes(src)) {
                    data.media_urls.push({
                        type: 'video',
                        url: src,
                        poster: video.poster
                    });
                }
            });

            // Extract image URLs from the ad
            const adImages = document.querySelectorAll('div[role="main"] img[src*="scontent"]');
            adImages.forEach(img => {
                // Filter out tiny images (icons, profile pics)
                if (img.naturalWidth > 100 || img.width > 100) {
                    if (!data.media_urls.some(m => m.url === img.src)) {
                        data.media_urls.push({
                            type: 'image',
                            url: img.src,
                            alt: img.alt
                        });
                    }
                }
            });

            // Extract CTA/link caption
            const ctaSelectors = [
                'div[data-ad-preview="cta-button"]',
                'a[role="link"] span[class*="x1lliihq"]',
                'div[role="button"] span'
            ];

            for (const selector of ctaSelectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    const text = el.textContent?.trim();
                    // Common CTA patterns
                    if (text && ['Shop now', 'Learn more', 'Sign up', 'Download', 'Get offer', 'Book now', 'Subscribe'].some(cta =>
                        text.toLowerCase().includes(cta.toLowerCase())
                    )) {
                        if (!data.ad_creative_link_captions.includes(text)) {
                            data.ad_creative_link_captions.push(text);
                        }
                    }
                });
            }

            // Try to detect platforms (usually shown as icons or text)
            const platformText = document.body.textContent;
            if (platformText.includes('Facebook')) data.publisher_platforms.push('facebook');
            if (platformText.includes('Instagram')) data.publisher_platforms.push('instagram');
            if (platformText.includes('Messenger')) data.publisher_platforms.push('messenger');
            if (platformText.includes('Audience Network')) data.publisher_platforms.push('audience_network');

            // Extract start date if visible
            const datePattern = /Started running on ([A-Za-z]+ \d+, \d{4})/;
            const dateMatch = document.body.textContent.match(datePattern);
            if (dateMatch) {
                data.ad_delivery_start_time = dateMatch[1];
            }

        } catch (error) {
            console.error('AdMachin: Error extracting ad data:', error);
        }

        return data;
    }

    // Create floating save button
    function createSaveButton() {
        // Check if button already exists
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

            try {
                // Send to popup for authentication and saving
                chrome.runtime.sendMessage({
                    action: 'saveAd',
                    data: adData
                }, (response) => {
                    if (response?.success) {
                        btn.innerHTML = '<span>✓ Saved!</span>';
                        btn.classList.add('success');
                        setTimeout(() => {
                            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                <span>Save to AdMachin</span>
              `;
                            btn.classList.remove('success');
                            btn.disabled = false;
                        }, 2000);
                    } else {
                        btn.innerHTML = '<span>✗ Error</span>';
                        btn.classList.add('error');
                        setTimeout(() => {
                            btn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                <span>Save to AdMachin</span>
              `;
                            btn.classList.remove('error');
                            btn.disabled = false;
                        }, 2000);
                    }
                });
            } catch (error) {
                console.error('AdMachin: Save error:', error);
                btn.innerHTML = '<span>✗ Error</span>';
                btn.disabled = false;
            }
        });

        document.body.appendChild(btn);
    }

    // Initialize when DOM is ready
    function init() {
        // Only activate on Ad Library pages with an ad ID
        if (window.location.href.includes('/ads/library/') &&
            window.location.search.includes('id=')) {
            // Wait a bit for the page to fully render
            setTimeout(createSaveButton, 2000);
        }
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also watch for URL changes (SPA navigation)
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
