# AdMachin FB Ad Library Saver

Chrome extension to save Facebook Ad Library ads directly to your AdMachin account.

## Installation

Since this is an unpacked extension, you'll need to load it manually:

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select this `extension` folder

## Setup

1. Click the extension icon in Chrome toolbar
2. In **Settings**, enter your Supabase anon key (from AdMachin's `.env` file: `VITE_SUPABASE_ANON_KEY`)
3. Click **Save Settings**

## Usage

1. Go to [Facebook Ad Library](https://www.facebook.com/ads/library/)
2. Search for ads and open one (URL should contain `?id=...`)
3. Click the **AdMachin extension icon** or the floating **Save to AdMachin** button
4. The ad will be saved to your FB Ad Library in AdMachin

## What Gets Extracted

- Ad text/body copy
- Headlines
- Video URLs (if present)
- Image URLs
- Page name
- Platform (Facebook, Instagram, etc.)
- Start date

## Troubleshooting

**"Could not extract ad data"**
- Make sure the ad content is fully loaded (scroll down if needed)
- Try refreshing the page

**"Missing Supabase key"**
- Configure your Supabase anon key in extension settings

**Extension not appearing**
- Make sure you loaded the unpacked extension
- Check that Developer mode is enabled

## Files

- `manifest.json` - Extension configuration
- `content.js` - Runs on FB Ad Library pages, extracts data
- `content.css` - Styles for floating button
- `popup.html/js` - Extension popup UI
- `background.js` - Handles API calls

## API Endpoint

The extension sends data to `/api/save-fb-ad` on your AdMachin deployment.
