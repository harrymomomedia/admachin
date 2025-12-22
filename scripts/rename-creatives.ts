/**
 * Script to rename creative files to {row_number}.{extension} format
 * Copies files in Supabase storage and updates the database
 *
 * Usage: npx tsx scripts/rename-creatives.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'creatives';

interface Creative {
    id: string;
    row_number: number;
    name: string;
    type: 'image' | 'video';
    storage_path: string;
}

function getExtension(storagePath: string): string {
    const parts = storagePath.split('.');
    return parts[parts.length - 1].toLowerCase();
}

async function copyFile(oldPath: string, newPath: string): Promise<boolean> {
    try {
        // Download the file
        const { data: fileData, error: downloadError } = await supabase.storage
            .from(BUCKET_NAME)
            .download(oldPath);

        if (downloadError || !fileData) {
            console.error(`  Failed to download ${oldPath}:`, downloadError);
            return false;
        }

        // Convert to buffer
        const buffer = Buffer.from(await fileData.arrayBuffer());

        // Determine content type
        const ext = getExtension(oldPath);
        const contentType = ext === 'mp4' ? 'video/mp4'
            : ext === 'mov' ? 'video/quicktime'
            : ext === 'webm' ? 'video/webm'
            : ext === 'png' ? 'image/png'
            : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
            : ext === 'gif' ? 'image/gif'
            : ext === 'webp' ? 'image/webp'
            : 'application/octet-stream';

        // Upload with new name
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(newPath, buffer, {
                cacheControl: '3600',
                upsert: true,
                contentType,
            });

        if (uploadError) {
            console.error(`  Failed to upload ${newPath}:`, uploadError);
            return false;
        }

        return true;
    } catch (error) {
        console.error(`  Copy error:`, error);
        return false;
    }
}

async function deleteOldFile(oldPath: string): Promise<void> {
    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([oldPath]);

    if (error) {
        console.error(`  Warning: Failed to delete old file ${oldPath}:`, error);
    }
}

async function updateStoragePath(id: string, newPath: string): Promise<boolean> {
    const { error } = await supabase
        .from('creatives')
        .update({ storage_path: newPath })
        .eq('id', id);

    if (error) {
        console.error(`  Failed to update storage_path:`, error);
        return false;
    }
    return true;
}

async function main() {
    console.log('=== Creative Rename Script ===\n');

    // Fetch all creatives
    const { data: creatives, error } = await supabase
        .from('creatives')
        .select('id, row_number, name, type, storage_path')
        .order('row_number', { ascending: true });

    if (error) {
        console.error('Failed to fetch creatives:', error);
        process.exit(1);
    }

    if (!creatives || creatives.length === 0) {
        console.log('No creatives found');
        return;
    }

    console.log(`Found ${creatives.length} creatives to process\n`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const creative of creatives as Creative[]) {
        const ext = getExtension(creative.storage_path);
        const newPath = `${creative.row_number}.${ext}`;

        // Skip if already renamed
        if (creative.storage_path === newPath) {
            console.log(`[${creative.row_number}] Already renamed - skipping`);
            skipCount++;
            continue;
        }

        console.log(`[${creative.row_number}] ${creative.storage_path} → ${newPath}`);

        // Copy file to new path
        const copied = await copyFile(creative.storage_path, newPath);
        if (!copied) {
            console.log(`[${creative.row_number}] FAILED - copy error\n`);
            failCount++;
            continue;
        }

        // Update database
        const updated = await updateStoragePath(creative.id, newPath);
        if (!updated) {
            console.log(`[${creative.row_number}] FAILED - database update error\n`);
            failCount++;
            continue;
        }

        // Delete old file
        await deleteOldFile(creative.storage_path);

        console.log(`[${creative.row_number}] SUCCESS\n`);
        successCount++;
    }

    console.log('=== Summary ===');
    console.log(`Success: ${successCount}`);
    console.log(`Skipped: ${skipCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total: ${creatives.length}`);
}

main().catch(console.error);
