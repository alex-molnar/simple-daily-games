import { defineConfig } from '@playwright/test'

// Chromium resolves *.localhost to loopback, and the nginx config answers on capitale.* etc.,
// so every game can be reached by its own hostname with no /etc/hosts changes.
export default defineConfig({
    testDir: 'tests/e2e',
    use: { baseURL: 'http://capitale.localhost:8080' },
    webServer: {
        command: 'docker rm -f sdg-static-e2e 2>/dev/null; docker build -q -f static/Dockerfile -t sdg-static:e2e . && docker run --rm --name sdg-static-e2e -p 8080:80 sdg-static:e2e',
        url: 'http://capitale.localhost:8080/',
        reuseExistingServer: false,
        timeout: 180_000,
    },
})
