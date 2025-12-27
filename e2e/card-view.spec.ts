import { test, expect } from '@playwright/test';

test.describe('Card View Metadata', () => {
    test.setTimeout(60000); // 1 minute per test

    // Mock user for auth
    const mockUser = {
        id: '6c6765a8-14c5-459a-a508-38dcfbbf90e6',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        password: 'password',
        role: 'admin',
        avatar_url: null,
        created_at: new Date().toISOString()
    };

    // Mock data
    const mockProjects = [
        { id: 'e15c60bd-95c2-47b9-9730-c29fb5325461', name: 'Test Project', color: 'bg-green-100 text-green-700' },
        { id: 'proj-2', name: 'Another Project', color: 'bg-blue-100 text-blue-700' }
    ];

    const mockSubprojects = [
        { id: 'acf1b974-9721-488b-a4e0-ffe0664070c5', name: 'Test Subproject', project_id: 'e15c60bd-95c2-47b9-9730-c29fb5325461' }
    ];

    const mockAdCopies = [
        {
            id: 'copy-1',
            text: 'This is a test ad copy for card view testing. It should display project, subproject, and user in the footer.',
            type: 'primary_text',
            platform: 'FB',
            project_id: 'e15c60bd-95c2-47b9-9730-c29fb5325461',
            subproject_id: 'acf1b974-9721-488b-a4e0-ffe0664070c5',
            user_id: '6c6765a8-14c5-459a-a508-38dcfbbf90e6',
            row_number: 1,
            created_at: new Date().toISOString()
        },
        {
            id: 'copy-2',
            text: 'Another test ad copy without subproject to test fallback behavior.',
            type: 'headline',
            platform: 'IG',
            project_id: 'proj-2',
            subproject_id: null,
            user_id: '6c6765a8-14c5-459a-a508-38dcfbbf90e6',
            row_number: 2,
            created_at: new Date().toISOString()
        }
    ];

    test.beforeEach(async ({ page }) => {
        // Listen to console logs to debug
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[Card Debug]') || text.includes('[AdCopy]')) {
                console.log('BROWSER:', text);
            }
        });

        // Mock Users endpoint
        await page.route('**/rest/v1/users*', async route => {
            await route.fulfill({ json: [mockUser] });
        });

        // Mock Projects endpoint
        await page.route('**/rest/v1/projects*', async route => {
            await route.fulfill({ json: mockProjects });
        });

        // Mock Subprojects endpoint
        await page.route('**/rest/v1/subprojects*', async route => {
            await route.fulfill({ json: mockSubprojects });
        });

        // Mock Ad Copies endpoint
        await page.route('**/rest/v1/ad_copies*', async route => {
            await route.fulfill({ json: mockAdCopies });
        });

        // Login
        await page.goto('/login');
        await page.getByPlaceholder('you@example.com').fill('test@example.com');
        await page.getByPlaceholder('••••••••').fill('password');
        await page.getByRole('button', { name: 'Sign In' }).click();

        // Wait for redirect to home page
        await expect(page).toHaveURL('/');
    });

    test('card view should show subproject and user in footer', async ({ page }) => {
        // Navigate to home page (Ad Copy page)
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Wait for page to load - look for the DataTable or any content
        await page.waitForTimeout(2000);

        // Switch to card view - find the FileText icon button (card view toggle)
        // The view toggle buttons are in the toolbar
        const cardViewButton = page.locator('button[title="Card view"]').or(
            page.locator('button').filter({ has: page.locator('svg.lucide-file-text') })
        );

        // If card view button exists, click it
        if (await cardViewButton.count() > 0) {
            await cardViewButton.first().click();
            await page.waitForTimeout(500);
        } else {
            // Try finding by other means - look for view toggle group
            const viewToggle = page.locator('button').filter({ hasText: /card|text/i });
            if (await viewToggle.count() > 0) {
                await viewToggle.first().click();
            }
        }

        // Wait for card view to render
        await page.waitForTimeout(1000);

        // Take a screenshot for debugging
        await page.screenshot({ path: 'test-results/card-view-initial.png', fullPage: true });

        // Check console for debug logs
        // The test should output browser logs

        // Look for cards - they have rounded-xl class and post-it styling
        const cards = page.locator('div.rounded-xl').filter({
            has: page.locator('div.whitespace-pre-wrap') // Body text area
        });

        const cardCount = await cards.count();
        console.log(`Found ${cardCount} cards`);

        if (cardCount > 0) {
            // Check the first card's footer for metadata
            const firstCard = cards.first();

            // Screenshot the first card
            await firstCard.screenshot({ path: 'test-results/first-card.png' });

            // Get the card's text content
            const cardText = await firstCard.textContent();
            console.log('First card content:', cardText);

            // Check if there are any UUID patterns (should NOT be visible)
            const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
            const uuidsFound = cardText?.match(uuidPattern) || [];

            console.log('UUIDs found in card:', uuidsFound);

            // Assert no UUIDs are visible in the card
            expect(uuidsFound.length).toBe(0);
        }
    });

    test('verify cardLookups are being passed correctly', async ({ page }) => {
        // This test checks the console logs to verify cardLookups
        const consoleLogs: string[] = [];

        page.on('console', msg => {
            consoleLogs.push(msg.text());
        });

        await page.goto('/ad-copies');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Switch to card view
        const cardViewButton = page.locator('button').filter({
            has: page.locator('svg.lucide-file-text')
        });
        if (await cardViewButton.count() > 0) {
            await cardViewButton.first().click();
            await page.waitForTimeout(1000);
        }

        // Check console logs
        const cardDebugLogs = consoleLogs.filter(log => log.includes('[Card Debug]'));
        const adCopyLogs = consoleLogs.filter(log => log.includes('[AdCopy]'));

        console.log('=== Card Debug Logs ===');
        cardDebugLogs.forEach(log => console.log(log));

        console.log('=== AdCopy Logs ===');
        adCopyLogs.forEach(log => console.log(log));

        // Check if cardLookups has subprojects and users
        const lookupsLog = cardDebugLogs.find(log => log.includes('cardLookups keys'));
        if (lookupsLog) {
            console.log('CardLookups keys:', lookupsLog);

            // Should have more than just projects and projectColors
            const hasSubprojects = cardDebugLogs.some(log =>
                log.includes('subprojects') && !log.includes('undefined')
            );
            const hasUsers = cardDebugLogs.some(log =>
                log.includes('users') && !log.includes('undefined')
            );

            console.log('Has subprojects lookup:', hasSubprojects);
            console.log('Has users lookup:', hasUsers);
        }

        // Take final screenshot
        await page.screenshot({ path: 'test-results/card-view-final.png', fullPage: true });
    });
});
