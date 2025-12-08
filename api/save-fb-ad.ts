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
        // Get the anon key from request header (sent by extension)
        const clientAnonKey = req.headers['x-supabase-key'] as string;

        if (!clientAnonKey) {
            return res.status(401).json({
                success: false,
                error: 'Missing Supabase anon key. Configure it in the extension settings.'
            });
        }

        // Create client with the provided anon key
        const supabase = createClient(supabaseUrl, clientAnonKey);

        const adData = req.body as AdData;

        if (!adData.ad_archive_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing ad_archive_id'
            });
        }

        // Check if ad already exists
        const { data: existing } = await supabase
            .from('fb_ads_library')
            .select('id')
            .eq('ad_archive_id', adData.ad_archive_id)
            .single();

        if (existing) {
            return res.status(200).json({
                success: true,
                message: 'Ad already saved',
                data: existing
            });
        }

        // Prepare ad data for insertion
        const insertData = {
            ad_archive_id: adData.ad_archive_id,
            page_id: adData.page_id,
            page_name: adData.page_name,
            ad_creative_bodies: adData.ad_creative_bodies,
            ad_creative_link_titles: adData.ad_creative_link_titles,
            ad_creative_link_descriptions: adData.ad_creative_link_descriptions,
            ad_creative_link_captions: adData.ad_creative_link_captions,
            publisher_platforms: adData.publisher_platforms,
            page_profile_picture_url: adData.page_profile_picture_url,
            ad_delivery_start_time: adData.ad_delivery_start_time ? new Date(adData.ad_delivery_start_time).toISOString() : null,
            // Store media URLs in ad_snapshot_url as JSON string
            ad_snapshot_url: adData.url,
            // Store extracted media in a custom field or as JSON
            raw_data: {
                media_urls: adData.media_urls,
                source_url: adData.url,
                extracted_at: new Date().toISOString()
            },
            is_saved: true
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
