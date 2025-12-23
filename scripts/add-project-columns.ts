/**
 * Script to add project_id and subproject_id columns to AI tables
 * Usage: npx tsx scripts/add-project-columns.ts
 */

import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function addColumns() {
    console.log('Adding project_id and subproject_id columns to AI tables...\n');

    const statements = [
        'ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id)',
        'ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS subproject_id UUID REFERENCES subprojects(id)',
        'ALTER TABLE ai_angles ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id)',
        'ALTER TABLE ai_angles ADD COLUMN IF NOT EXISTS subproject_id UUID REFERENCES subprojects(id)',
        'ALTER TABLE ai_generated_ads ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id)',
        'ALTER TABLE ai_generated_ads ADD COLUMN IF NOT EXISTS subproject_id UUID REFERENCES subprojects(id)',
        'ALTER TABLE creative_concepts ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id)',
        'ALTER TABLE creative_concepts ADD COLUMN IF NOT EXISTS subproject_id UUID REFERENCES subprojects(id)',
    ];

    for (const stmt of statements) {
        const tableName = stmt.match(/ALTER TABLE (\w+)/)?.[1];
        const columnName = stmt.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1];

        try {
            // Use the pg_query endpoint (if enabled) or raw SQL via PostgREST
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify({
                    query: stmt
                }),
            });

            if (response.ok) {
                console.log(`✓ ${tableName}.${columnName} added`);
            } else {
                const text = await response.text();
                console.log(`? ${tableName}.${columnName}: ${response.status} - trying alternative...`);
            }
        } catch (err: any) {
            console.log(`✗ ${tableName}.${columnName}: ${err.message}`);
        }
    }

    // Verify columns exist
    console.log('\nVerifying columns...');

    for (const table of ['ai_personas', 'ai_angles', 'ai_generated_ads', 'creative_concepts']) {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id,project_id,subproject_id&limit=1`, {
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                },
            });

            if (response.ok) {
                console.log(`✓ ${table}: columns exist`);
            } else {
                const error = await response.json();
                console.log(`✗ ${table}: ${error.message || JSON.stringify(error)}`);
            }
        } catch (err: any) {
            console.log(`✗ ${table}: ${err.message}`);
        }
    }

    console.log('\n---\nIf columns are not added, run this SQL in Supabase Dashboard > SQL Editor:\n');
    console.log(statements.join(';\n') + ';');
}

addColumns().catch(console.error);
