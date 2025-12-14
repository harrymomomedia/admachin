---
description: Pre-commit verification checklist
---

# Pre-Commit Verification

## Automated Checks
// turbo
1. Run TypeScript check: `npx tsc --noEmit`
// turbo
2. Run linter: `npm run lint` (if available)

## Manual Verification
3. Test the feature at http://localhost:5173
4. Verify no console errors in browser DevTools
5. Check responsive behavior if UI changes were made

## Code Quality
6. Remove any console.log statements
7. Remove unused imports
8. Ensure no `any` types where specific types are possible

## Ready to Commit
// turbo
9. Stage changes: `git add .`
10. Create commit with descriptive message
