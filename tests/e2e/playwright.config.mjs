import { defineConfig } from '@playwright/test';

// The browser is deliberately external to this repository. Point IKMAL_E2E_URL
// at a disposable Trilium profile/DB (the default is the local dev instance).
const baseURL = process.env.IKMAL_E2E_URL || 'http://127.0.0.1:37840';

export default defineConfig({
    // Paths in a Playwright config are resolved relative to this config file.
    testDir: '.',
    testMatch: /.*\.spec\.mjs/,
    fullyParallel: false,
    workers: 1,
    timeout: 45_000,
    expect: { timeout: 8_000 },
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL,
        storageState: process.env.IKMAL_E2E_STORAGE_STATE || undefined,
        // Local development can reuse an installed Chromium/Chrome; CI can
        // omit this and use `npx playwright install chromium`.
        launchOptions: { executablePath: process.env.IKMAL_E2E_BROWSER || undefined },
        viewport: { width: 1280, height: 900 },
        ignoreHTTPSErrors: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
});
