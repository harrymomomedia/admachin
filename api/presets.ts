import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role key (server-side only)
const getSupabaseAdmin = () => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error('Missing Supabase configuration');
    }

    return createClient(url, serviceKey);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const supabase = getSupabaseAdmin();

        // GET - List all presets
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('ai_copywriting_presets')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            return res.status(200).json(data);
        }

        // POST - Create new preset
        if (req.method === 'POST') {
            const { data, error } = await supabase
                .from('ai_copywriting_presets')
                .insert(req.body)
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json(data);
        }

        // PUT - Update preset
        if (req.method === 'PUT') {
            const { id, ...updates } = req.body;
            if (!id) {
                return res.status(400).json({ error: 'Missing preset id' });
            }

            const { data, error } = await supabase
                .from('ai_copywriting_presets')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return res.status(200).json(data);
        }

        // DELETE - Delete preset
        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id || typeof id !== 'string') {
                return res.status(400).json({ error: 'Missing preset id' });
            }

            const { error } = await supabase
                .from('ai_copywriting_presets')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return res.status(204).end();
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Preset API error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
}
