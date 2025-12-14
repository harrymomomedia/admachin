---
description: Template for defining new feature requirements
---

# Feature: [Feature Name]

## Overview
Brief description of what this feature should do.

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

## UI/UX Guidelines
- Match existing [component name] styling
- Use colors from index.css design system
- Follow Airtable-style patterns for [specific elements]

## Technical Constraints
- Must work with existing DataTable component
- No new dependencies unless necessary
- TypeScript strict mode compliance

## Files to Modify/Create
- `src/components/NewComponent.tsx` - [NEW]
- `src/pages/ExistingPage.tsx` - [MODIFY]

## Verification
// turbo
1. Run `npx tsc --noEmit` to verify types
2. Test in browser at [specific URL]
3. Verify [specific behavior]
