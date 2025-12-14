---
description: Cleanup unused code and fix lints
---

# Code Cleanup

## Step 1: Find Issues
// turbo
1. Run TypeScript check: `npx tsc --noEmit`
2. Review any errors or warnings

## Step 2: Fix Common Issues
3. Remove unused imports
4. Remove unused variables and functions
5. Replace `any` types with specific types
6. Remove commented-out code blocks

## Step 3: Consolidate Patterns
7. Move repeated logic into helper functions
8. Extract reusable components
9. Centralize color/style tokens in index.css

## Step 4: Verify
// turbo
10. Run TypeScript check again: `npx tsc --noEmit`
11. Test application still works
