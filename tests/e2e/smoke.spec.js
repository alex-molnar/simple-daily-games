import { test, expect } from '@playwright/test'

const zeros = { started: 0, attempts1: 0, attempts2: 0, attempts3: 0, attempts4: 0, attempts5: 0, attempts6: 0, attempts_plus: 0, failures: 0 }

for (const game of ['capitale', 'countryle', 'grayscale', 'invertedle']) {
    test(`${game} loads on its own hostname and accepts a guess`, async ({ page }) => {
        const errors = []
        const external = []
        page.on('pageerror', e => errors.push(e.message))
        page.on('request', r => {
            const { hostname } = new URL(r.url())
            if (!hostname.endsWith('.localhost') && hostname !== 'api.games.kak.im' && !/google|kofi|ko-fi/.test(hostname)) external.push(r.url())
        })
        await page.route('https://api.games.kak.im/**', route => route.fulfill({ json: zeros }))
        await page.route(/fonts\.(googleapis|gstatic)\.com|ko-fi\.com/, route => route.abort())

        await page.goto(`http://${game}.localhost:8080/`)
        await expect(page.locator('#game-title')).toHaveText(new RegExp(game, 'i'))

        await page.locator('#guess-input').fill('a')
        await page.locator('.suggestion-item').first().click()
        await page.locator('#submit-button').click()

        // The guess is stored under the game's own name, so the hostname picked the right game.
        await expect.poll(() => page.evaluate(g => Object.keys(localStorage).filter(k => k.startsWith(`${g}-2`))
            .map(k => JSON.parse(localStorage.getItem(k)).length), game)).toEqual([1])
        expect(errors).toEqual([])
        expect(external).toEqual([])
    })
}

test('landing page lists the four games', async ({ page }) => {
    await page.goto('http://home.games.localhost:8080/')
    await expect(page.locator('a.game-tile')).toHaveCount(4)
})

test('invalid guess shows an inline message instead of an alert', async ({ page }) => {
    let dialogs = 0
    page.on('dialog', d => { dialogs++; d.dismiss() })
    await page.route('https://api.games.kak.im/**', route => route.fulfill({ json: zeros }))
    await page.route(/fonts\.(googleapis|gstatic)\.com|ko-fi\.com/, route => route.abort())

    await page.goto('http://countryle.localhost:8080/')
    await page.locator('#guess-input').fill('zzzz')
    await page.locator('#submit-button').click()

    await expect(page.locator('#guess-error')).toContainText('valid')
    await expect(page.locator('#guess-input')).toHaveClass(/shake/)
    expect(dialogs).toBe(0)

    await page.locator('#guess-input').fill('a')
    await expect(page.locator('#guess-error')).toBeEmpty()
})
