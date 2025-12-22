# AI Copy Restructure Design

**Date:** 2025-12-22
**Status:** Approved

## Overview

Restructure the AI Copywriting feature into a modular system with separate data tables and a unified generation wizard.

## Navigation

**Folder:** AI Copy (replaces Copywriting)

| Page | Route | Description |
|------|-------|-------------|
| Copy Wizard | `/copy-wizard` | Generation workflow |
| Copy Library | `/copy-library` | Tabbed DataTable for all saved items |

**Pages to remove:**
- `/ai-copywriting` (replaced by Copy Wizard)
- `/saved-personas` (merged into Copy Library)

## Database Schema

### campaign_parameters (base)
```sql
CREATE TABLE campaign_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  persona_input TEXT,
  swipe_files TEXT,
  custom_prompt TEXT,
  project_id UUID REFERENCES projects(id),
  subproject_id UUID REFERENCES subprojects(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### creative_concepts (base, pre-seeded)
```sql
CREATE TABLE creative_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  example TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data
INSERT INTO creative_concepts (name, description) VALUES
  ('Testimonial', 'First-person account from a customer or user'),
  ('Listicle', 'Numbered list of benefits, reasons, or tips'),
  ('Problem-Solution', 'Present pain point, then offer the solution'),
  ('Exposé', 'Reveal hidden truth or industry secret'),
  ('Before/After', 'Show transformation from problem to result'),
  ('How-To', 'Step-by-step guide or tutorial approach'),
  ('Comparison', 'Compare against alternatives or competitors'),
  ('Story/Narrative', 'Tell a relatable story that leads to product'),
  ('Question Hook', 'Open with provocative question'),
  ('Statistic Lead', 'Lead with surprising data or research');
```

### personas (depends on campaign)
```sql
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_parameter_id UUID REFERENCES campaign_parameters(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### angles (depends on campaign + persona + creative concept)
```sql
CREATE TABLE angles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_parameter_id UUID REFERENCES campaign_parameters(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
  creative_concept_id UUID REFERENCES creative_concepts(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### generated_ads (depends on all)
```sql
CREATE TABLE generated_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_parameter_id UUID REFERENCES campaign_parameters(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
  angle_id UUID REFERENCES angles(id) ON DELETE SET NULL,
  creative_concept_id UUID REFERENCES creative_concepts(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  ad_type TEXT NOT NULL, -- 'FB Ad Text', 'FB Ad Headline', 'Video Transcript', 'Video Ad Script'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Dependencies

| Entity | Depends On |
|--------|------------|
| Campaign Parameters | — (base) |
| Creative Concepts | — (base, pre-seeded) |
| Personas | Campaign Parameters |
| Angles | Campaign + Persona + Creative Concepts |
| Ads | Campaign + Persona + Angles + Creative Concepts |

## DataTable Tabs Feature

New reusable tabs feature for DataTable component:

```tsx
<DataTable
  tabs={[
    { id: 'campaign-params', label: 'Campaign Params', count: 12 },
    { id: 'personas', label: 'Personas', count: 45 },
    { id: 'angles', label: 'Angles', count: 120 },
    { id: 'creative-concepts', label: 'Creative Concepts', count: 15 },
    { id: 'ads', label: 'Ads', count: 89 },
  ]}
  activeTab="personas"
  onTabChange={(tabId) => { /* load different data */ }}
  columns={columns}
  data={data}
/>
```

Tab bar renders above the toolbar, with optional count badges.

## Copy Wizard Page

Accordion-style sections, similar to current PersonaAICopy:

### Section 1: Campaign Parameters
- Text fields: description, persona input, swipe files, custom prompt
- Project/Subproject selectors
- Auto-Fill button (AI generates from brief)
- Load from Library / Save to Library buttons
- Generate Personas button

### Section 2: Personas
- Campaign selector (dropdown of saved + "Current")
- Generate X personas input
- Generated personas display as cards (single text field each)
- Select/deselect for saving
- Save Selected button
- Load from Library button
- Generate Angles button

### Section 3: Angles
- Campaign, Personas (multi), Creative Concepts (multi) selectors
- Generate X angles input
- Generated angles display as cards
- Select/deselect for saving
- Save Selected button
- Generate Ads button

### Section 4: Ads
- Campaign, Personas, Angles, Creative Concepts selectors
- Ad Type dropdown
- Generate X ads input
- Generated ads display as cards
- Select/deselect for saving
- Save Selected to Library button

## Copy Library Page

Single page with tabbed DataTable:

- **Campaign Params tab**: DataTable of saved campaign parameters
- **Personas tab**: DataTable of saved personas
- **Angles tab**: DataTable of saved angles
- **Creative Concepts tab**: DataTable of creative concepts (pre-seeded + user-added)
- **Ads tab**: DataTable of generated ads

Each tab supports:
- View all items
- Inline editing
- Delete
- Filter by project/date

## Implementation Order

1. Database migrations (5 tables + seed data)
2. DataTable tabs feature
3. Supabase service functions (CRUD for each table)
4. Copy Library page (tabbed DataTable)
5. Copy Wizard page (refactor PersonaAICopy)
6. Update navigation (rename folder, update routes)
7. Remove deprecated pages/code
