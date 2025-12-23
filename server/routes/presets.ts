/**
 * Presets API Routes - Express version
 * Converted from Vercel serverless functions
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const router = Router();

// Create Supabase client with service role key (server-side only)
function getSupabaseAdmin(): SupabaseClient | null {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        return null;
    }

    return createClient(url, serviceKey);
}

// ============================================
// GET /api/presets - List all presets
// ============================================
router.get('/', async (_req: Request, res: Response) => {
    try {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return res.status(500).json({ error: 'Missing Supabase configuration' });
        }

        const { data, error } = await supabase
            .from('ai_copywriting_presets')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return res.json(data);
    } catch (error) {
        console.error('Preset API error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});

// ============================================
// POST /api/presets - Create new preset
// ============================================
router.post('/', async (req: Request, res: Response) => {
    try {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return res.status(500).json({ error: 'Missing Supabase configuration' });
        }

        const { data, error } = await supabase
            .from('ai_copywriting_presets')
            .insert(req.body)
            .select()
            .single();

        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        console.error('Preset API error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});

// ============================================
// PUT /api/presets - Update preset
// ============================================
router.put('/', async (req: Request, res: Response) => {
    try {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            console.error('Preset PUT: Missing Supabase configuration');
            return res.status(500).json({ error: 'Missing Supabase configuration' });
        }

        const { id, ...updates } = req.body;
        console.log('Preset PUT: Updating preset', id, 'with', Object.keys(updates));

        if (!id) {
            return res.status(400).json({ error: 'Missing preset id' });
        }

        // Remove fields that shouldn't be updated
        delete updates.created_at;
        delete updates.created_by;

        const { data, error } = await supabase
            .from('ai_copywriting_presets')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Preset PUT Supabase error:', error);
            throw error;
        }

        console.log('Preset PUT: Successfully updated', data?.name);
        return res.json(data);
    } catch (error: any) {
        console.error('Preset PUT error:', error);
        // Handle Supabase errors which have a message property but aren't Error instances
        const errorMessage = error?.message || (error instanceof Error ? error.message : 'Internal server error');
        return res.status(500).json({ error: errorMessage });
    }
});

// ============================================
// DELETE /api/presets - Delete preset
// ============================================
router.delete('/', async (req: Request, res: Response) => {
    try {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return res.status(500).json({ error: 'Missing Supabase configuration' });
        }

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
    } catch (error) {
        console.error('Preset API error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});

export default router;
