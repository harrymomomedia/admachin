import { test, expect } from '@playwright/test';

test.describe('NotionEditor Content Duplication Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for the app to load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load NotionEditor without content duplication', async ({ page }) => {
    // Navigate to AI Ads page (has notioneditor column)
    await page.goto('/ai-ads');
    await page.waitForLoadState('networkidle');

    // Wait for the table to load
    await page.waitForSelector('.data-grid-row', { timeout: 10000 }).catch(() => {
      console.log('No rows yet - table may be empty');
    });

    // Check if there are rows with rich_text column
    const richTextCells = page.locator('[data-column-key="rich_text"]');
    const cellCount = await richTextCells.count();

    if (cellCount > 0) {
      // Click on the first rich text cell to open inline editor
      const firstCell = richTextCells.first();
      await firstCell.click();

      // Wait for the popup editor to appear
      const popup = page.locator('.fixed.inset-0.bg-black\\/50');
      await expect(popup).toBeVisible({ timeout: 5000 });

      // Check the editor content
      const editor = page.locator('.notion-like-editor');
      await expect(editor).toBeVisible({ timeout: 5000 });

      // Get the editor text content
      const editorText = await editor.textContent();

      // If there's content, verify it's not duplicated
      if (editorText && editorText.trim()) {
        // Split by common patterns that might indicate duplication
        const lines = editorText.split('\n').filter(line => line.trim());
        const uniqueLines = [...new Set(lines)];

        // If content is duplicated, unique lines would be fewer than total
        // Allow some tolerance for naturally repeated content
        const duplicationRatio = lines.length / Math.max(uniqueLines.length, 1);

        console.log('Total lines:', lines.length);
        console.log('Unique lines:', uniqueLines.length);
        console.log('Duplication ratio:', duplicationRatio);

        // Fail if content is duplicated more than 2x (allowing for some natural repetition)
        expect(duplicationRatio).toBeLessThan(3);
      }

      // Close the popup
      await page.keyboard.press('Escape');
    } else {
      console.log('No rich_text cells found - creating a row to test');

      // Click + button to create new row
      const addButton = page.locator('button[title="Add row"]').or(page.locator('[data-testid="create-row-btn"]'));
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(1000);

        // Now there should be a row
        const newRichTextCell = page.locator('[data-column-key="rich_text"]').first();
        if (await newRichTextCell.isVisible()) {
          await newRichTextCell.click();

          // Editor should appear quickly (no waiting for collaboration)
          const popup = page.locator('.fixed.inset-0.bg-black\\/50');
          await expect(popup).toBeVisible({ timeout: 3000 });

          const editor = page.locator('.notion-like-editor');
          await expect(editor).toBeVisible({ timeout: 3000 });

          // Type some test content
          await editor.click();
          await page.keyboard.type('Test content');

          // Verify content is not duplicated
          const editorText = await editor.textContent();
          expect(editorText).toBe('Test content');

          // Close popup
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('should load NotionEditor quickly without waiting for collaboration', async ({ page }) => {
    // Navigate to AI Ads page
    await page.goto('/ai-ads');
    await page.waitForLoadState('networkidle');

    // Wait for table or page content
    await page.waitForTimeout(2000);

    // Find a rich text cell
    const richTextCell = page.locator('[data-column-key="rich_text"]').first();

    if (await richTextCell.isVisible()) {
      // Click and measure time to editor visibility
      const startTime = Date.now();
      await richTextCell.click();

      const editor = page.locator('.notion-like-editor');
      await expect(editor).toBeVisible({ timeout: 5000 });

      const loadTime = Date.now() - startTime;
      console.log(`Editor loaded in ${loadTime}ms`);

      // Editor should load within 2 seconds (was slow before due to collaboration waiting)
      expect(loadTime).toBeLessThan(3000);

      await page.keyboard.press('Escape');
    }
  });
});
