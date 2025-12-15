import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

// Load env manually
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
});

const supabase = createClient(
    envVars.VITE_SUPABASE_URL,
    envVars.VITE_SUPABASE_ANON_KEY
);

async function cleanup() {
    console.log('Searching for broken test files...');

    // Find broken files
    const { data: files, error: fetchError } = await supabase
        .from('creatives')
        .select('id, name, file_size, storage_path')
        .eq('name', 'new-image.jpg')
        .eq('file_size', 15);

    if (fetchError) {
        console.error('Fetch error:', fetchError);
        return;
    }

    console.log('Found files to delete:', files?.length || 0);
    if (files) files.forEach(f => console.log('  -', f.id, f.name, f.file_size, 'bytes'));

    if (files && files.length > 0) {
        // Delete from storage
        const paths = files.map(f => f.storage_path).filter(Boolean);
        if (paths.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('creatives')
                .remove(paths);
            if (storageError) console.error('Storage delete error:', storageError);
            else console.log('Deleted from storage:', paths.length, 'files');
        }

        // Delete from database
        const ids = files.map(f => f.id);
        const { error: dbError } = await supabase
            .from('creatives')
            .delete()
            .in('id', ids);

        if (dbError) console.error('DB delete error:', dbError);
        else console.log('Deleted from database:', ids.length, 'records');
    }

    console.log('Cleanup complete!');
}

cleanup();
