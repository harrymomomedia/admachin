/**
 * Script to rename video files to {row_number}.mp4 format
 * Downloads from temp URLs and uploads to Supabase storage
 *
 * Usage: npx tsx scripts/rename-videos.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'video-generator';

interface VideoOutput {
    id: string;
    row_number: number;
    final_video_url: string | null;
    sora_url: string | null;
    new_url: string | null;
}

async function downloadVideo(url: string): Promise<Buffer | null> {
    try {
        console.log(`  Downloading from: ${url.substring(0, 60)}...`);
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`  Failed to download: ${response.status} ${response.statusText}`);
            return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error(`  Download error:`, error);
        return null;
    }
}

async function uploadToSupabase(buffer: Buffer, rowNumber: number): Promise<string | null> {
    const filePath = `${rowNumber}.mp4`;

    console.log(`  Uploading as: ${filePath}`);

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'video/mp4',
        });

    if (error) {
        console.error(`  Upload error:`, error);
        return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

async function updateNewUrl(id: string, newUrl: string): Promise<boolean> {
    const { error } = await supabase
        .from('video_output')
        .update({ new_url: newUrl })
        .eq('id', id);

    if (error) {
        console.error(`  Failed to update new_url:`, error);
        return false;
    }
    return true;
}

async function main() {
    console.log('=== Video Rename Script ===\n');

    // Fetch all video outputs that have a video URL but no new_url
    const { data: videos, error } = await supabase
        .from('video_output')
        .select('id, row_number, final_video_url, sora_url, new_url')
        .or('final_video_url.not.is.null,sora_url.not.is.null')
        .is('new_url', null)
        .order('row_number', { ascending: true });

    if (error) {
        console.error('Failed to fetch videos:', error);
        process.exit(1);
    }

    if (!videos || videos.length === 0) {
        console.log('No videos to process (all have new_url set or no source URL)');
        return;
    }

    console.log(`Found ${videos.length} videos to process\n`);

    let successCount = 0;
    let failCount = 0;

    for (const video of videos as VideoOutput[]) {
        const sourceUrl = video.sora_url || video.final_video_url;

        if (!sourceUrl) {
            console.log(`[${video.row_number}] Skipping - no source URL`);
            continue;
        }

        console.log(`[${video.row_number}] Processing...`);

        // Download video
        const buffer = await downloadVideo(sourceUrl);
        if (!buffer) {
            console.log(`[${video.row_number}] FAILED - download error\n`);
            failCount++;
            continue;
        }

        console.log(`  Downloaded: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

        // Upload to Supabase
        const newUrl = await uploadToSupabase(buffer, video.row_number);
        if (!newUrl) {
            console.log(`[${video.row_number}] FAILED - upload error\n`);
            failCount++;
            continue;
        }

        // Update database
        const updated = await updateNewUrl(video.id, newUrl);
        if (!updated) {
            console.log(`[${video.row_number}] FAILED - database update error\n`);
            failCount++;
            continue;
        }

        console.log(`[${video.row_number}] SUCCESS → ${newUrl}\n`);
        successCount++;
    }

    console.log('=== Summary ===');
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total: ${videos.length}`);
}

main().catch(console.error);
