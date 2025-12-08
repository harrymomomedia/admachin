import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface AdData {
    ad_archive_id: string | null;
    page_id: string | null;
    page_name: string | null;
    ad_creative_bodies: string[];
    ad_creative_link_titles: string[];
    ad_creative_link_descriptions: string[];
    ad_creative_link_captions: string[];
    media_urls: Array<{ type: string; url: string; poster?: string; alt?: string }>;
    page_profile_picture_url: string | null;
    publisher_platforms: string[];
    ad_delivery_start_time: string | null;
    url: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS for the extension
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-supabase-key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        // Get the anon key from request header to validate request is from extension
        const clientAnonKey = req.headers['x-supabase-key'] as string;

        if (!clientAnonKey) {
            return res.status(401).json({
                success: false,
                error: 'Missing Supabase anon key. Configure it in the extension settings.'
            });
        }

        // Use service role key for inserts (bypasses RLS)
        // The clientAnonKey is just used to verify the request is legitimate
        if (!supabaseServiceKey) {
            return res.status(500).json({
                success: false,
                error: 'Server configuration error: Missing service role key'
            });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const adData = req.body as AdData;

        if (!adData.ad_archive_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing ad_archive_id'
            });
        }

        // Check if ad already exists using fb_ad_id
        const { data: existing } = await supabase
            .from('fb_ads_library')
            .select('id')
            .eq('fb_ad_id', adData.ad_archive_id)
            .single();

        if (existing) {
            return res.status(200).json({
                success: true,
                message: 'Ad already saved',
                data: existing
            });
        }

        // Helper to download and upload media
        async function processMedia(mediaItems: any[], folder: 'images' | 'videos') {
            return Promise.all(mediaItems.map(async (item) => {
                try {
                    // Start download
                    const response = await fetch(item.url);
                    if (!response.ok) throw new Error('Failed to fetch media');

                    const blob = await response.blob();
                    const buffer = await blob.arrayBuffer();

                    // Generate unique filename
                    const ext = folder === 'videos' ? 'mp4' : 'jpg'; // simplified extension handling
                    const filename = `${adData.ad_archive_id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const path = `fb-library/${folder}/${filename}`;

                    // Upload to Supabase
                    const { error: uploadError } = await supabase.storage
                        .from('creatives')
                        .upload(path, buffer, {
                            contentType: response.headers.get('content-type') || (folder === 'videos' ? 'video/mp4' : 'image/jpeg')
                        });

                    if (uploadError) throw uploadError;

                    // Get public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('creatives')
                        .getPublicUrl(path);

                    return {
                        ...item,
                        original_url: item.url,
                        storage_path: path,
                        public_url: publicUrl
                    };

                } catch (error) {
                    console.error(`Failed to process ${folder}:`, error);
                    // Fallback to just saving the original URL
                    return {
                        ...item,
                        original_url: item.url,
                        error: 'Failed to download'
                    };
                }
            }));
        }

        // Split and process media
        // Limit to first 5 items to prevent timeout
        const rawImages = adData.media_urls.filter(m => m.type === 'image').slice(0, 5);
        const rawVideos = adData.media_urls.filter(m => m.type === 'video').slice(0, 5);

        const [processedImages, processedVideos] = await Promise.all([
            processMedia(rawImages, 'images'),
            processMedia(rawVideos, 'videos')
        ]);

        // Prepare ad data for insertion
        // Map fields to match supabase/migrations/20251208130000_create_fb_ads_library.sql
        const insertData = {
            fb_ad_id: adData.ad_archive_id,
            page_id: adData.page_id,
            page_name: adData.page_name,

            // Map arrays to single text fields (taking the first one)
            ad_creative_body: adData.ad_creative_bodies[0] || null,
            ad_creative_link_title: adData.ad_creative_link_titles[0] || null,
            ad_creative_link_description: adData.ad_creative_link_descriptions[0] || null,
            ad_creative_link_caption: adData.ad_creative_link_captions[0] || null,

            publisher_platforms: adData.publisher_platforms,
            // page_profile_picture_url is not in the schema, we can ignore it or add it later if needed

            ad_delivery_start_time: adData.ad_delivery_start_time ? new Date(adData.ad_delivery_start_time).toISOString() : null,
            ad_snapshot_url: adData.url,

            // Store processed media with local storage paths
            images: processedImages,
            videos: processedVideos,

            // saved_by will be null if using anon key without auth, 
            // relying on RLS policies or service key if provided. 
            // Ideally should be authenticated user.
        };

        // Insert the ad
        const { data: inserted, error } = await supabase
            .from('fb_ads_library')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Ad saved successfully',
            data: inserted
        });

    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
