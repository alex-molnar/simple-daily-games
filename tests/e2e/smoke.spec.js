import { test, expect } from '@playwright/test'

const zeros = { started: 0, attempts1: 0, attempts2: 0, attempts3: 0, attempts4: 0, attempts5: 0, attempts6: 0, attempts_plus: 0, failures: 0 }

for (const game of ['grayscale', 'invertedle']) {
    test(`${game} keeps its daily flag on reload without repeating the reported date pair`, async ({ page }) => {
        await page.route(/api\.games\.kak\.im/, route => route.fulfill({ json: zeros }))
        await page.clock.setFixedTime(new Date('2026-09-30T12:00:00Z'))
        await page.goto(`http://${game}.localhost:8080/`)
        const flag = page.locator('#flag-image')
        await expect(flag).toHaveAttribute('src', /\.png$/)
        const previous = await flag.getAttribute('src')
        await page.reload()
        await expect(flag).toHaveAttribute('src', previous)
        await page.clock.setFixedTime(new Date('2026-10-02T12:00:00Z'))
        await page.reload()
        await expect(flag).not.toHaveAttribute('src', previous)
        await expect.poll(() => flag.evaluate(image => image.naturalWidth)).toBeGreaterThan(0)
    })
}

for (const game of ['capitale', 'countryle', 'grayscale', 'invertedle']) {
    test(`${game} loads on its own hostname and accepts a guess`, async ({ page }) => {
        const errors = []
        const external = []
        page.on('pageerror', e => errors.push(e.message))
        page.on('request', r => {
            const { hostname } = new URL(r.url())
            if (!hostname.endsWith('.localhost') && hostname !== 'api.games.kak.im') external.push(r.url())
        })
        await page.route('https://api.games.kak.im/**', route => route.fulfill({ json: zeros }))

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

test('landing page lists the five games', async ({ page }) => {
    await page.goto('http://home.games.localhost:8080/')
    await expect(page.locator('a.game-tile')).toHaveCount(5)
})

test('landing page has the approved content, catalogue navigation and production links', async ({ page }) => {
    await page.goto('http://home.games.localhost:8080/')

    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('main h1')).toHaveCount(1)
    await expect(page.locator('main h1')).toHaveText(/A little curiosity\.\s*Every day\./)
    await expect(page.locator('main h2')).toHaveCount(1)
    await expect(page.locator('#games-title')).toHaveText('Choose your next challenge')
    await expect(page.locator('a.game-tile h3')).toHaveCount(5)
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Games' })).toHaveAttribute('href', '#games-title')
    await expect(page.getByRole('link', { name: 'Explore games' })).toHaveAttribute('href', '#games-title')

    const games = ['capitale', 'countryle', 'grayscale', 'invertedle', 'geo-fun-factle']
    for (const [index, game] of games.entries()) {
        const tile = page.locator('a.game-tile').nth(index)
        await expect(tile).toHaveAttribute('href', `https://${game}.kak.im`)
        await expect(tile).toContainText('Play')
        await expect(tile.locator('img')).toHaveAttribute('alt', '')
    }
    await expect.poll(() => page.locator('.tile-art').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true)
    await expect.poll(() => page.evaluate(() => document.fonts.check('600 24px Fraunces') && document.fonts.check('400 16px "DM Sans"'))).toBe(true)

    await page.getByRole('link', { name: 'Explore games' }).click()
    await expect(page.locator('#games-title')).toBeInViewport()
})

test('landing page keyboard navigation starts with a working skip link', async ({ page }) => {
    await page.goto('http://home.games.localhost:8080/')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(page.locator('main')).toBeInViewport()
    await expect(page.locator('main')).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Explore games' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Games' })).toBeFocused()
})

test('landing page reflows at 200% text size on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto('http://home.games.localhost:8080/')
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })

    const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        headingSize: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
        tileSizes: [...document.querySelectorAll('.game-tile')].map(tile => {
            const art = tile.querySelector('img').getBoundingClientRect()
            const content = tile.querySelector('.tile-content').getBoundingClientRect()
            return { artBottom: art.bottom, contentTop: content.top, contentWidth: content.width, contentHeight: content.height }
        }),
    }))

    expect(layout.overflow).toBeLessThanOrEqual(0)
    expect(layout.headingSize).toBeGreaterThan(48)
    for (const tile of layout.tileSizes) {
        expect(tile.contentWidth).toBeGreaterThan(0)
        expect(tile.contentHeight).toBeGreaterThan(0)
        expect(tile.contentTop).toBeGreaterThanOrEqual(tile.artBottom)
    }
})

test('catalogue reflows from one to twelve entries at the reviewed widths', async ({ page }) => {
    await page.goto('http://home.games.localhost:8080/')

    for (const count of [1, 4, 5, 12]) {
        await page.locator('.games-grid').evaluate((grid, targetCount) => {
            const original = [...grid.querySelectorAll('.game-tile')]
            while (grid.children.length > targetCount) grid.lastElementChild.remove()
            while (grid.children.length < targetCount) {
                const index = grid.children.length
                const tile = original[index % original.length].cloneNode(true)
                tile.querySelector('.tile-title').textContent = index === 11 ? 'A Curious Traveller’s Challenge' : `Extra game ${index + 1}`
                tile.querySelector('.tile-description').textContent = 'Find a new daily puzzle and follow the clues wherever they lead.'
                grid.append(tile)
            }
        }, count)
        await expect(page.locator('a.game-tile')).toHaveCount(count)

        for (const width of [320, 390, 768, 1024, 1440]) {
            await page.setViewportSize({ width, height: 900 })
            const layout = await page.evaluate(() => ({
                overflow: document.documentElement.scrollWidth - innerWidth,
                columns: getComputedStyle(document.querySelector('.games-grid')).gridTemplateColumns.split(' ').length,
                lastTile: document.querySelector('.game-tile:last-child').getBoundingClientRect().toJSON(),
            }))
            expect(layout.overflow, `${count} games at ${width}px`).toBeLessThanOrEqual(0)
            expect(layout.columns, `${count} games at ${width}px`).toBe(width <= 620 ? 1 : width <= 900 ? 2 : 3)
            expect(layout.lastTile.width, `${count} games at ${width}px`).toBeGreaterThan(0)
        }
    }
})

test('invalid guess shows an inline message instead of an alert', async ({ page }) => {
    let dialogs = 0
    page.on('dialog', d => { dialogs++; d.dismiss() })
    await page.route('https://api.games.kak.im/**', route => route.fulfill({ json: zeros }))

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
    await expect(page.locator('a.game-tile').nth(3)).toHaveAttribute('href', 'https://test.invertedle.kak.im')
    await expect(page.getByRole('link', { name: /geo funfactle/i })).toHaveAttribute('href', 'https://test.geo-fun-factle.kak.im')
    await page.goto('http://invertedle.localhost:8080/')
    await expect(page.locator('#nav-next')).toHaveAttribute('href', 'https://geo-fun-factle.kak.im')
})

// A finished flag game (six guesses already stored for today) opens the stats popup on load.
const finishedGame = game => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(`${game}-${today}`, JSON.stringify(['France', 'Germany', 'Spain', 'Italy', 'Japan', 'Brazil']))
}

test('stats popup opens while the global stats request is still pending', async ({ page }) => {
    let answer
    const pending = new Promise(resolve => { answer = resolve })
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
    await page.route(/api\.games\.kak\.im/, route => {
        const path = new URL(route.request().url()).pathname
        // Visits feed the metrics only; these tests are about game calls.
        if (!path.endsWith('/visit')) calls.push(`${route.request().method()} ${path.split('/').slice(4).join('/')}`)
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

for (const width of [320, 390]) {
    test(`every game fits a ${width}px wide phone screen`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        await page.route(/api\.games\.kak\.im/, route => route.fulfill({ json: zeros }))
        for (const game of ['capitale', 'countryle', 'grayscale', 'invertedle']) {
            await page.goto(`http://${game}.localhost:8080/`)
            const overflow = await page.evaluate(() => ({
                page: document.documentElement.scrollWidth - innerWidth,
                // Clipped content does not widen the page, so check the arrows themselves too.
                arrows: Math.max(...[...document.querySelectorAll('.nav-arrow')].map(a => a.getBoundingClientRect().right)) - innerWidth,
            }))
            expect(overflow.page, `${game} page`).toBeLessThanOrEqual(0)
            expect(overflow.arrows, `${game} nav arrows`).toBeLessThanOrEqual(0)
        }
    })
}

for (const [host, game] of [['capitale', 'capitale'], ['countryle', 'countryle'], ['grayscale', 'grayscale'], ['invertedle', 'invertedle'], ['home.games', 'landing']]) {
    test(`${host} reports one visit for the metrics`, async ({ page }) => {
        const visits = []
        await page.route(/api\.games\.kak\.im/, route => {
            if (route.request().url().endsWith('/visit')) visits.push(new URL(route.request().url()).pathname)
            return route.fulfill({ json: zeros })
        })
        await page.goto(`http://${host}.localhost:8080/`)
        await expect.poll(() => visits).toEqual([`/games/${game}/today/visit`])
    })
}

// The privacy page promises that opening a page contacts no one but us; the footer links only leave on click.
for (const host of ['capitale', 'countryle', 'grayscale', 'invertedle', 'geo-fun-factle', 'home.games']) {
    test(`${host} has the site footer, contacts no third party and links to the privacy page`, async ({ page }) => {
        const external = []
        page.on('request', r => {
            const { hostname } = new URL(r.url())
            if (!hostname.endsWith('.localhost') && hostname !== 'api.games.kak.im') external.push(r.url())
        })
        await page.route('https://api.games.kak.im/**', route => route.fulfill({ json: zeros }))
        await page.goto(`http://${host}.localhost:8080/`)

        const footer = page.locator('footer.site-footer')
        await expect(footer.getByRole('link')).toHaveText(['Privacy', 'Email', 'GitHub', 'Buy me a coffee'])
        await expect(footer.getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:molnar.alex98@gmail.com')
        await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/alex-molnar/simple-daily-games')
        await expect(footer.getByRole('link', { name: 'Buy me a coffee' })).toHaveAttribute('href', 'https://ko-fi.com/R5H524XXQ8')
        await expect(footer.locator('.coffee-button')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

        await footer.getByRole('link', { name: 'Privacy' }).click()
        await expect(page).toHaveURL(`http://${host}.localhost:8080/privacy`)
        await expect(page.locator('h1')).toHaveText('Privacy')
        await expect(page.locator('#home-link')).toHaveAttribute('href', 'https://home.games.kak.im')
        expect(external).toEqual([])
    })
}
