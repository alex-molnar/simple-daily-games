import { test, expect } from '@playwright/test'
import { countryData, countryNames } from '../../shared/countryData.js'
import { getRandomSelectionForToday } from '../../shared/mathHelpers.js'
import { hasCompleteClues } from '../../geo-fun-factle/gameState.js'

const zeros = { started: 0, attempts1: 0, attempts2: 0, attempts3: 0, attempts4: 0, attempts5: 0, attempts6: 0, attempts_plus: 0, failures: 0 }
const eligible = countryNames.filter(name => hasCompleteClues(countryData[name]))
const fixedTime = new Date()
fixedTime.setUTCHours(12, 0, 0, 0)
const answerForToday = getRandomSelectionForToday(eligible, 'geo-fun-factle')
const postedActions = calls => calls.filter(call => call.startsWith('POST ')).map(call => call.slice(call.indexOf('/today/') + '/today/'.length))
const setFixedClock = page => page.clock.install({ time: fixedTime })

async function mockApi(page, calls = []) {
    await page.route(/fonts\.(googleapis|gstatic)\.com|ko-fi\.com/, route => route.abort())
    await page.route(/api\.games\.kak\.im/, route => {
        const url = new URL(route.request().url())
        calls.push(`${route.request().method()} ${url.pathname}`)
        return route.fulfill({ json: zeros })
    })
    return calls
}

test('welcome, skip, restored progress, keyboard selection, completion, and completed restore', async ({ page }) => {
    const calls = await mockApi(page)
    await setFixedClock(page)
    await page.setViewportSize({ width: 872, height: 1000 })
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await expect(page).toHaveTitle('Geo Funfactle')
    await expect(page.locator('#welcome-screen')).toBeVisible()
    await expect(page.locator('#clue-list')).toBeEmpty()

    await page.getByRole('button', { name: 'Start game' }).click()
    await expect(page.locator('#clue-list .clue-value')).toHaveText(countryData[answerForToday].nationalSport)
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('#clue-list .attempt-note')).toHaveText('Your guess: Skipped')
    await expect(page.locator('#clue-list .clue-value')).toHaveCount(2)

    await page.reload()
    await expect(page.locator('#welcome-screen')).toBeVisible()
    await expect(page.locator('#saved-note')).toBeVisible()
    await page.getByRole('button', { name: 'Start game' }).click()
    await expect(page.locator('#clue-list .attempt-note')).toHaveText('Your guess: Skipped')
    await expect(page.locator('#clue-list .clue-value')).toHaveCount(2)

    const input = page.getByRole('combobox', { name: 'Your country' })
    await input.fill(answerForToday)
    const shellTopBeforeWin = (await page.locator('.page-shell').boundingBox()).y
    await input.press('Enter')
    await expect(page.locator('#result-screen')).toBeVisible()
    expect((await page.locator('.page-shell').boundingBox()).y).toBe(shellTopBeforeWin)
    const confetti = page.locator('#confetti-container .confetti').first()
    await expect(confetti).toBeAttached()
    await expect(confetti).toHaveCSS('animation-name', 'confettiFall')
    await page.locator('#stats-button').click()
    await expect(page.locator('.stats-popup')).toBeVisible()
    const [confettiZIndex, statsZIndex] = await Promise.all([
        page.locator('#confetti-container').evaluate(element => Number(getComputedStyle(element).zIndex)),
        page.locator('.stats-popup-overlay').evaluate(element => Number(getComputedStyle(element).zIndex))
    ])
    expect(confettiZIndex).toBeLessThan(statsZIndex)
    await page.keyboard.press('Escape')
    await expect(page.locator('#result-heading')).toContainText(answerForToday)
    await expect(page.locator('#result-facts .result-fact')).toHaveCount(6)
    await expect(page.locator('#result-message')).toHaveText('Solved in 2 attempts')
    await expect.poll(() => postedActions(calls)).toEqual([
        'start_game', 'success_game/2'
    ])

    await page.reload()
    await expect(page.locator('#result-screen')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start game' })).toBeHidden()
    expect(postedActions(calls)).toEqual(['start_game', 'success_game/2'])
    await page.locator('#stats-button').click()
    const closeStats = page.getByRole('button', { name: 'Close stats popup' })
    await expect(closeStats).toBeFocused()
    const localTab = page.getByRole('tab', { name: 'My stats' })
    const globalTab = page.getByRole('tab', { name: 'Global stats' })
    await localTab.focus()
    await page.keyboard.press('ArrowRight')
    await expect(globalTab).toBeFocused()
    await expect(globalTab).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(localTab).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(globalTab).toBeFocused()
    await closeStats.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(page.locator('.stats-popup').getByRole('link')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(closeStats).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('#stats-button')).toBeFocused()
})

test('duplicate guesses are rejected and six skips record one failure', async ({ page }) => {
    const calls = await mockApi(page)
    await setFixedClock(page)
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await page.getByRole('button', { name: 'Start game' }).click()
    const input = page.getByRole('combobox', { name: 'Your country' })
    await input.fill('Brazil')
    await input.press('ArrowDown')
    await input.press('Enter')
    await input.fill('Brazil')
    await expect(page.locator('#suggestions-container')).toBeHidden()
    await input.press('Enter')
    await expect(page.locator('#guess-error')).toHaveText('You already guessed this country')
    await expect(page.locator('#attempt-count')).toHaveText('Attempt 2 of 6')

    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('#result-message')).toContainText("Today's country was")
    await expect.poll(() => postedActions(calls)).toEqual(['start_game', 'failed_game'])
})

test('keyboard navigation exposes only one selected listbox option', async ({ page }) => {
    await mockApi(page)
    await setFixedClock(page)
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await page.getByRole('button', { name: 'Start game' }).click()
    const input = page.getByRole('combobox', { name: 'Your country' })
    await input.fill('a')
    await input.press('ArrowDown')
    await input.press('ArrowDown')
    const selected = page.locator('#suggestions-container [aria-selected="true"]')
    await expect(selected).toHaveCount(1)
    await expect(input).toHaveValue(await selected.textContent())
    await expect(input).toHaveAttribute('aria-activedescendant', await selected.getAttribute('id'))
    await input.press('Escape')
    await expect(input).toHaveAttribute('aria-expanded', 'false')
    await expect(input).not.toHaveAttribute('aria-activedescendant')
})

test('Enter with an empty input after a skip does not submit a stale suggestion', async ({ page }) => {
    await mockApi(page)
    await setFixedClock(page)
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await page.getByRole('button', { name: 'Start game' }).click()
    const input = page.getByRole('combobox', { name: 'Your country' })
    await input.fill('Brazil')
    await expect(page.locator('#suggestions-container li')).toHaveCount(1)
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(input).toHaveValue('')
    await input.press('Enter')
    await expect(page.locator('#attempt-count')).toHaveText('Attempt 2 of 6')
    await expect(page.locator('#clue-list .attempt-note')).toHaveCount(1)
})

test('input and clue list do not show false controls or horizontal scrolling', async ({ page }) => {
    await mockApi(page)
    await setFixedClock(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await page.getByRole('button', { name: 'Start game' }).click()
    const input = page.getByRole('combobox', { name: 'Your country' })
    const unfocusedBorder = await input.evaluate(element => getComputedStyle(element).borderColor)
    await input.focus()
    await expect(input).toHaveCSS('outline-width', '1px')
    await expect(input).toHaveCSS('border-color', unfocusedBorder)
    expect(await page.locator('.input-wrap').evaluate(element => getComputedStyle(element, '::after').content)).toBe('none')
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('#clue-list')).toHaveJSProperty('scrollWidth', await page.locator('#clue-list').evaluate(element => element.clientWidth))
})

test('clue list scrolls to the latest guess and desktop page margins are reduced', async ({ page }) => {
    await mockApi(page)
    await setFixedClock(page)
    await page.setViewportSize({ width: 872, height: 500 })
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await page.getByRole('button', { name: 'Start game' }).click()
    const list = page.locator('#clue-list')
    for (let index = 0; index < 4; index++) await page.getByRole('button', { name: 'Skip' }).click()
    const scroll = await list.evaluate(element => ({ top: element.scrollTop, max: element.scrollHeight - element.clientHeight }))
    expect(scroll.top).toBeGreaterThan(0)
    expect(scroll.top).toBe(scroll.max)
    const shell = page.locator('.page-shell')
    await expect(shell).toHaveCSS('width', '720px')
    expect((await shell.boundingBox()).x).toBe(76)

    await page.setViewportSize({ width: 320, height: 800 })
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    await page.getByRole('button', { name: 'Start game' }).click()
    const narrowList = page.locator('#clue-list')
    for (let index = 0; index < 4; index++) {
        await page.getByRole('button', { name: 'Skip' }).click()
        const position = await narrowList.evaluate(element => ({ top: element.scrollTop, max: element.scrollHeight - element.clientHeight }))
        expect(position.top, `latest clue after ${index + 1} skips`).toBe(position.max)
    }
})

test('invalid input and unavailable storage do not consume or block attempts', async ({ page }) => {
    await mockApi(page)
    await setFixedClock(page)
    await page.addInitScript(() => {
        const setItem = Storage.prototype.setItem
        Storage.prototype.setItem = function (key, value) {
            if (key.startsWith('geo-fun-factle-')) throw new Error('Storage unavailable')
            return setItem.call(this, key, value)
        }
    })
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await page.getByRole('button', { name: 'Start game' }).click()
    await expect(page.locator('#storage-message')).toHaveText('Progress cannot be saved in this browser.')
    await page.getByRole('combobox', { name: 'Your country' }).fill('not a country')
    await page.getByRole('button', { name: 'Guess' }).click()
    await expect(page.locator('#guess-error')).toHaveText('Please select a country from the suggestions.')
    await expect(page.locator('#attempt-count')).toHaveText('Attempt 1 of 6')
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('#clue-list .attempt-note')).toHaveText('Your guess: Skipped')
    await expect(page.locator('#clue-list .clue-value')).toHaveCount(2)
})

test('a failed completion request keeps the result and never retries on restore', async ({ page }) => {
    const calls = []
    await page.route(/fonts\.(googleapis|gstatic)\.com|ko-fi\.com/, route => route.abort())
    await page.route(/api\.games\.kak\.im/, route => {
        const path = new URL(route.request().url()).pathname
        calls.push(`${route.request().method()} ${path}`)
        if (path.endsWith('/failed_game')) return route.fulfill({ status: 503, json: { detail: 'unavailable' } })
        return route.fulfill({ json: zeros })
    })
    await setFixedClock(page)
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await page.getByRole('button', { name: 'Start game' }).click()
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('#result-screen')).toBeVisible()
    await expect(page.locator('#sync-message')).toHaveText('Your result is saved here, but could not sync globally.')
    await page.reload()
    await expect(page.locator('#result-screen')).toBeVisible()
    expect(calls.filter(call => call.endsWith('/failed_game'))).toHaveLength(1)
})

test('local completion stats show while the completion POST is pending', async ({ page }) => {
    const calls = []
    let releasePost
    const pendingPost = new Promise(resolve => { releasePost = resolve })
    await page.route(/fonts\.(googleapis|gstatic)\.com|ko-fi\.com/, route => route.abort())
    await page.route(/api\.games\.kak\.im/, async route => {
        const request = route.request()
        const path = new URL(request.url()).pathname
        calls.push(`${request.method()} ${path}`)
        if (path.endsWith('/failed_game')) {
            await pendingPost
            return route.fulfill({ json: zeros })
        }
        return route.fulfill({ json: zeros })
    })
    await setFixedClock(page)
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await page.getByRole('button', { name: 'Start game' }).click()
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('.stats-popup')).toBeVisible()
    await expect(page.locator('.stats-chart-row[data-key="games_failed"] .stats-chart-value')).toHaveText('1')
    expect(calls.filter(call => call.endsWith('/stats'))).toHaveLength(1)
    releasePost()
    await expect.poll(() => calls.filter(call => call.endsWith('/stats'))).toHaveLength(2)
})

test('a malformed local stats value cannot block game completion', async ({ page }) => {
    const calls = await mockApi(page)
    await setFixedClock(page)
    await page.addInitScript(() => localStorage.setItem('geo-fun-factle-stats', JSON.stringify('corrupt')))
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await page.getByRole('button', { name: 'Start game' }).click()
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('#result-screen')).toBeVisible()
    await expect.poll(() => postedActions(calls)).toContain('failed_game')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('geo-fun-factle-stats')).games_failed)).toBe(1)
})

test('an action after UTC midnight resets to the new welcome screen', async ({ page }) => {
    const beforeMidnight = new Date(fixedTime)
    beforeMidnight.setUTCHours(23, 59, 30, 0)
    const nextDay = new Date(beforeMidnight.getTime() + 60_000).toISOString().slice(0, 10)
    await page.clock.install({ time: beforeMidnight })
    await mockApi(page)
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await page.getByRole('button', { name: 'Start game' }).click()
    await page.clock.fastForward('00:01:00')
    await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('#welcome-screen')).toBeVisible()
    await expect(page.locator('#puzzle-date')).toHaveAttribute('datetime', nextDay)
    expect(await page.evaluate(day => Object.keys(localStorage).some(key => key === `geo-fun-factle-${day}`), nextDay)).toBe(false)
})

test('results and the stats dialog reflow with 200% text at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await mockApi(page)
    await setFixedClock(page)
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    await page.getByRole('button', { name: 'Start game' }).click()
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Skip' }).click()
    await expect(page.locator('#result-screen')).toBeVisible()
    await page.waitForTimeout(1600)
    const overflow = await page.evaluate(() => ({
        pixels: document.documentElement.scrollWidth - innerWidth,
        elements: [...document.querySelectorAll('body *')].map(element => ({ name: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}.${element.className}`, text: element.textContent?.slice(0, 80), parent: element.parentElement?.className, right: Math.round(element.getBoundingClientRect().right) })).filter(element => element.right > innerWidth + 1)
    }))
    expect(overflow.pixels, JSON.stringify(overflow.elements)).toBeLessThanOrEqual(0)
    await expect(page.locator('.stats-popup')).toBeVisible()
})

test('test host uses the test API and navigation destinations', async ({ page }) => {
    const apiHosts = new Set()
    await page.route(/api\.games\.kak\.im/, route => {
        apiHosts.add(new URL(route.request().url()).hostname)
        return route.fulfill({ json: zeros })
    })
    await page.route(/fonts\.(googleapis|gstatic)\.com|ko-fi\.com/, route => route.abort())
    await setFixedClock(page)
    await page.goto('http://test.geo-fun-factle.localhost:8080/')
    await expect(page.locator('#nav-prev')).toHaveAttribute('href', 'https://test.home.games.kak.im')
    await expect(page.locator('.home-link')).toHaveAttribute('href', 'https://test.invertedle.kak.im')
    await expect.poll(() => [...apiHosts]).toEqual(['test.api.games.kak.im'])
})

test('Passport layout restores three clues, updates progress, and opens header stats', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 872, height: 1200 })
    await page.route(/api\.games\.kak\.im/, route => route.fulfill({ json: zeros }))
    await setFixedClock(page)
    await page.addInitScript(day => {
        localStorage.setItem(`geo-fun-factle-${day}`, JSON.stringify({
            version: 1, date: day, answer: 'France', started: true,
            attempts: [{ country: 'Brazil' }, { country: null }], status: 'playing', completionRecorded: false
        }))
    }, fixedTime.toISOString().slice(0, 10))
    await page.goto('http://geo-fun-factle.localhost:8080/')
    await expect(page.locator('.globe')).toBeVisible()
    await expect.poll(() => page.locator('.globe').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true)
    await page.evaluate(async () => { await document.fonts.ready })
    await page.screenshot({ path: testInfo.outputPath('passport-welcome.png'), fullPage: true })
    await page.getByRole('link', { name: 'Skip to game' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#game-content')).toBeFocused()
    await page.getByRole('button', { name: 'Start game' }).click()
    await expect(page.locator('#attempt-count')).toHaveText('Attempt 3 of 6')
    await expect(page.locator('#attempt-dots .filled')).toHaveCount(3)
    await expect(page.locator('#next-clue')).toHaveText('Next clue: National animal')
    await expect(page.locator('.attempt-note.guessed')).toHaveText('Your guess: Brazil Incorrect')
    await expect(page.locator('.attempt-note.skipped')).toHaveText('Your guess: Skipped')
    await page.getByRole('combobox', { name: 'Your country' }).blur()
    await page.screenshot({ path: testInfo.outputPath('passport-playing-desktop.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: testInfo.outputPath('passport-playing-phone.png'), fullPage: true })
    await page.locator('#header-stats-button').click()
    await expect(page.locator('.stats-popup')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#header-stats-button')).toBeFocused()
    await page.setViewportSize({ width: 320, height: 800 })
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await expect(page.locator('#attempt-dots .filled')).toHaveCount(4)
    await expect(page.locator('#next-clue')).toHaveText('Next clue: National dish')
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await expect(page.locator('#next-clue')).toBeHidden()
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await expect(page.locator('#result-screen')).toBeVisible()
    await expect(page.locator('#attempt-progress')).toBeHidden()
    await page.evaluate(() => { document.documentElement.style.fontSize = '' })
    await page.screenshot({ path: testInfo.outputPath('passport-result-phone.png'), fullPage: true })
})

for (const width of [320, 390, 768, 1280]) {
    test(`Geo Funfactle reflows at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 850 })
        await mockApi(page)
        await setFixedClock(page)
        await page.goto('http://geo-fun-factle.localhost:8080/')
        await page.getByRole('button', { name: 'Start game' }).click()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
        expect(overflow).toBeLessThanOrEqual(0)
    })
}
