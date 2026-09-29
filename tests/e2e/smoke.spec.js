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

test('test.* hosts pick the game after the prefix and only talk to the test API', async ({ page }) => {
    const apiHosts = new Set()
    page.on('request', r => { const { hostname } = new URL(r.url()); if (hostname.includes('api.games')) apiHosts.add(hostname) })
    await page.route(/api\.games\.kak\.im/, route => route.fulfill({ json: zeros }))
    await page.route(/fonts\.(googleapis|gstatic)\.com|ko-fi\.com/, route => route.abort())

    await page.goto('http://test.grayscale.localhost:8080/')
    await expect(page.locator('#game-title')).toHaveText(/grayscale/i)
    await expect(page.locator('#nav-next')).toHaveAttribute('href', 'https://test.invertedle.kak.im')
    // Stats are only sent when the game ends, so play it out (a win or six misses).
    for (let i = 0; i < 6 && await page.locator('#guess-input').isEnabled(); i++) {
        await page.locator('#guess-input').fill('a')
        await page.locator('.suggestion-item').first().click()
        await page.locator('#submit-button').click()
        await expect(page.locator('#feedback-overlay')).not.toHaveClass(/show/)
    }
    await expect.poll(() => [...apiHosts], { timeout: 15_000 }).toEqual(['test.api.games.kak.im'])

    await page.goto('http://test.home.games.localhost:8080/')
    await expect(page.locator('a.game-tile').first()).toHaveAttribute('href', /^https:\/\/test\.capitale\.kak\.im/)
})

// A finished flag game (six guesses already stored for today) opens the stats popup on load.
const finishedGame = game => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(`${game}-${today}`, JSON.stringify(['France', 'Germany', 'Spain', 'Italy', 'Japan', 'Brazil']))
}

test('stats popup opens while the global stats request is still pending', async ({ page }) => {
    let answer
    const pending = new Promise(resolve => { answer = resolve })
    await page.route(/fonts\.(googleapis|gstatic)\.com|ko-fi\.com/, route => route.abort())
    await page.route(/api\.games\.kak\.im\/.*\/stats$/, async route => { await pending; await route.fulfill({ json: { ...zeros, attempts2: 5 } }) })
    await page.route(/api\.games\.kak\.im/, route => route.fallback())
    await page.addInitScript(finishedGame, 'grayscale')

    await page.goto('http://grayscale.localhost:8080/')
    // A synchronous request would freeze the page here until the API answered.
    await expect(page.locator('.stats-popup')).toBeVisible()
    await page.getByRole('tab', { name: /global/i }).click()
    await expect(page.locator('.stats-popup-summary')).toHaveText(/loading/i)

    answer()
    await expect(page.locator('.stats-popup-summary')).not.toHaveText(/loading/i)
    await expect(page.locator('.stats-chart-row[data-key="games_with_attempts_2"] .stats-chart-value')).toHaveText('5')
})

test('stats popup still opens when the API is down', async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com|ko-fi\.com/, route => route.abort())
    await page.route(/api\.games\.kak\.im/, route => route.abort())
    await page.addInitScript(finishedGame, 'grayscale')

    await page.goto('http://grayscale.localhost:8080/')
    await expect(page.locator('.stats-popup')).toBeVisible()
    await page.getByRole('tab', { name: /global/i }).click()
    await expect(page.locator('.stats-popup-summary')).toHaveText(/unavailable/i)
})

// Records every API call in order, e.g. "GET stats", "POST failed_game".
async function recordApi(page, statsBody) {
    const calls = []
    await page.route(/fonts\.(googleapis|gstatic)\.com|ko-fi\.com/, route => route.abort())
    await page.route(/api\.games\.kak\.im/, route => {
        const path = new URL(route.request().url()).pathname
        calls.push(`${route.request().method()} ${path.split('/').slice(4).join('/')}`)
        return route.fulfill({ json: path.endsWith('/stats') ? statsBody() : {} })
    })
    return calls
}

const statValue = (page, key) => page.locator(`.stats-chart-row[data-key="${key}"] .stats-chart-value`)

test('stats button shows global stats loaded in the background at game start', async ({ page }) => {
    const calls = await recordApi(page, () => ({ ...zeros, attempts3: 7 }))
    await page.goto('http://capitale.localhost:8080/')
    await expect.poll(() => calls).toEqual(['GET stats'])

    await page.getByRole('button', { name: /stats/i }).click()
    await expect(page.locator('.stats-popup')).toBeVisible()
    await page.getByRole('tab', { name: /global/i }).click()
    await expect(statValue(page, 'games_with_attempts_3')).toHaveText('7')
})

test('finishing a game updates the stats after the result is saved', async ({ page }) => {
    let failures = 0
    const calls = await recordApi(page, () => ({ ...zeros, failures }))
    await page.goto('http://grayscale.localhost:8080/')
    await expect.poll(() => calls).toEqual(['GET stats'])

    failures = 4 // the API now includes this player's result
    for (let i = 0; i < 6 && await page.locator('#guess-input').isEnabled(); i++) {
        await page.locator('#guess-input').fill('a')
        await page.locator('.suggestion-item').first().click()
        await page.locator('#submit-button').click()
        await expect(page.locator('#feedback-overlay')).not.toHaveClass(/show/)
    }
    // Global stats are fetched again only once the result has been posted.
    await expect.poll(() => calls.slice(1).join(' | ')).toMatch(/^POST (failed_game|success_game\/\d) \| GET stats$/)

    await expect(page.locator('.stats-popup')).toBeVisible()
    const result = calls[1].startsWith('POST failed') ? 'games_failed' : `games_with_attempts_${calls[1].split('/')[1]}`
    await expect(statValue(page, result)).toHaveText('1') // the local tab: this game
    if (result === 'games_failed') {
        await page.getByRole('tab', { name: /global/i }).click()
        await expect(statValue(page, 'games_failed')).toHaveText('4')
    }
})

test('giving up records a failed game, survives a reload and opens the stats', async ({ page }) => {
    const calls = await recordApi(page, () => zeros)
    await page.goto('http://countryle.localhost:8080/')
    await expect.poll(() => calls).toEqual(['GET stats'])

    await page.locator('#hint-button').click()
    await expect.poll(() => calls).toEqual(['GET stats', 'POST failed_game', 'GET stats'])
    await expect(page.locator('.stats-popup')).toBeVisible()
    await expect(statValue(page, 'games_failed')).toHaveText('1')

    await page.reload()
    await expect(page.locator('#guess-input')).toBeDisabled()
    await expect(page.locator('.stats-popup')).toBeVisible()
    await expect(statValue(page, 'games_failed')).toHaveText('1') // not counted twice
    expect(calls.filter(c => c.startsWith('POST'))).toEqual(['POST failed_game'])
})
