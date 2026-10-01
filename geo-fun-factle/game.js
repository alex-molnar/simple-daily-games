import { countryData, countryNames } from '../shared/countryData.js'
import { getRandomSelectionForToday } from '../shared/mathHelpers.js'
import { siteUrl } from '../shared/env.js'
import { getStats, updateStats } from '../shared/gameHandler.js'
import { postRequest } from '../shared/sendRequest.js'
import { launchConfetti } from '../shared/animations.js'
import { createStatsPopup } from '../shared/statsPopup.js'
import { applyAttempt, formatPopulation, hasCompleteClues } from './gameState.js'

const gameId = 'geo-fun-factle'
const eligibleCountries = countryNames.filter(name => hasCompleteClues(countryData[name]))
const clueLabels = ['National sport', 'Popular landmark category', 'Population', 'National animal', 'National dish', 'Most popular religion']
const clueValues = record => [record.nationalSport, record.mostVisitedLandmarkCategory, formatPopulation(record.country.population), record.nationalAnimal, record.nationalDish, record.mostPopularReligion]
const today = () => new Date().toISOString().slice(0, 10)
const keyForDay = day => `${gameId}-${day}`
const byId = id => document.getElementById(id)
const statsOrder = [...Array(6)].map((_, index) => `games_with_attempts_${index + 1}`).concat('games_failed')
const statsLabels = Object.fromEntries(statsOrder.map((key, index) => [key, index === 6 ? 'Failed' : `${index + 1} attempts`]))

byId('nav-prev').href = siteUrl('invertedle')
byId('nav-next').href = siteUrl('home.games')
byId('nav-next').textContent = 'Daily Games'
byId('puzzle-date').dateTime = today()
byId('puzzle-date').textContent = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${today()}T00:00:00Z`))

const statsPopup = createStatsPopup(getStats(gameId), {
    gameTitle: gameId,
    title: 'Geo Funfactle statistics',
    order: statsOrder,
    labels: statsLabels,
    kofiImageNumber: 6
})
let currentDay = today()
let gameState = freshState(currentDay)
let selectedCountry = null
let selectedIndex = -1
let turnBusy = false

function freshState(day) {
    return { version: 1, date: day, answer: getRandomSelectionForToday(eligibleCountries, gameId), started: false, attempts: [], status: 'playing', completionRecorded: false }
}

function loadState(day) {
    try {
        const raw = localStorage.getItem(keyForDay(day))
        if (!raw) return freshState(day)
        const saved = JSON.parse(raw)
        if (saved.version !== 1 || saved.date !== day || typeof saved.started !== 'boolean' || typeof saved.completionRecorded !== 'boolean' || !eligibleCountries.includes(saved.answer) || !Array.isArray(saved.attempts) || saved.attempts.length > 6 || (saved.attempts.length > 0 && !saved.started)) throw new Error('Invalid saved game')
        let restored = { ...freshState(day), answer: saved.answer, started: saved.started }
        for (const attempt of saved.attempts) {
            if (!attempt || !(attempt.country === null || countryNames.includes(attempt.country))) throw new Error('Invalid saved attempt')
            const next = applyAttempt(restored, attempt.country, saved.answer)
            if (next.error || restored.status !== 'playing') throw new Error('Invalid saved attempt sequence')
            restored = next.state
        }
        if (saved.completionRecorded && restored.status === 'playing') throw new Error('Invalid completion marker')
        restored.completionRecorded = saved.completionRecorded
        return restored
    } catch {
        try { localStorage.removeItem(keyForDay(day)) } catch { /* Storage can be disabled by the browser. */ }
        return freshState(day)
    }
}

function persistState() {
    try {
        localStorage.setItem(keyForDay(currentDay), JSON.stringify(gameState))
        return true
    } catch {
        byId('storage-message').textContent = 'Progress cannot be saved in this browser.'
        return false
    }
}

function showScreen(screen) {
    for (const id of ['welcome-screen', 'game-screen', 'result-screen']) byId(id).hidden = id !== screen
}

function appendAttemptNote(row, attempt) {
    const note = document.createElement('span')
    note.className = 'attempt-note'
    if (attempt.country === null) note.textContent = 'Skipped'
    else {
        const result = document.createElement('span')
        result.className = attempt.country === gameState.answer ? 'correct' : 'incorrect'
        result.textContent = attempt.country === gameState.answer ? 'Correct' : 'Incorrect'
        note.append(document.createTextNode(`${attempt.country} · `), result)
    }
    row.appendChild(note)
}

function renderClues(revealIndex = -1) {
    const list = byId('clue-list')
    list.replaceChildren()
    const visible = gameState.status === 'playing' ? Math.min(6, gameState.attempts.length + 1) : 6
    const values = clueValues(countryData[gameState.answer])
    for (let index = 0; index < visible; index++) {
        const row = document.createElement('li')
        row.className = `clue-row${index === gameState.attempts.length && gameState.status === 'playing' ? ' active' : ''}${index === revealIndex ? ' reveal' : ''}`
        const text = document.createElement('span')
        const label = document.createElement('span')
        label.className = 'clue-label'
        label.textContent = clueLabels[index]
        const value = document.createElement('span')
        value.className = 'clue-value'
        value.textContent = values[index]
        text.append(label, value)
        row.appendChild(text)
        if (gameState.attempts[index]) appendAttemptNote(row, gameState.attempts[index])
        list.appendChild(row)
    }
    if (revealIndex >= 0) byId('clue-announcement').textContent = `Clue ${revealIndex + 1}: ${clueLabels[revealIndex]}, ${values[revealIndex]}.`
    byId('attempt-count').textContent = `Attempt ${Math.min(gameState.attempts.length + 1, 6)} of 6`
}

function renderSuggestions() {
    const input = byId('guess-input')
    const list = byId('suggestions-container')
    selectedCountry = null
    selectedIndex = -1
    const query = input.value.trim().toLocaleLowerCase()
    list.replaceChildren()
    if (!query) {
        list.hidden = true
        input.setAttribute('aria-expanded', 'false')
        input.removeAttribute('aria-activedescendant')
        return
    }
    const matches = countryNames.filter(name => name.toLocaleLowerCase().includes(query)).slice(0, 8)
    matches.forEach((name, index) => {
        const option = document.createElement('li')
        option.id = `country-option-${index}`
        option.className = 'suggestion-item'
        option.setAttribute('role', 'option')
        option.setAttribute('aria-selected', 'false')
        option.textContent = name
        option.addEventListener('mousedown', event => event.preventDefault())
        option.addEventListener('click', () => chooseSuggestion(index))
        list.appendChild(option)
    })
    list.hidden = matches.length === 0
    input.setAttribute('aria-expanded', String(matches.length > 0))
    input.removeAttribute('aria-activedescendant')
}

function chooseSuggestion(index) {
    const list = byId('suggestions-container')
    const option = list.children[index]
    if (!option) return
    for (const suggestion of list.children) suggestion.setAttribute('aria-selected', 'false')
    option.setAttribute('aria-selected', 'true')
    selectedIndex = index
    selectedCountry = option.textContent
    byId('guess-input').value = selectedCountry
    byId('suggestions-container').hidden = true
    byId('guess-input').setAttribute('aria-expanded', 'false')
    byId('guess-input').removeAttribute('aria-activedescendant')
}

function resetForUtcDay() {
    const nextDay = today()
    if (nextDay === currentDay) return false
    currentDay = nextDay
    gameState = loadState(currentDay)
    byId('puzzle-date').dateTime = currentDay
    byId('puzzle-date').textContent = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${currentDay}T00:00:00Z`))
    byId('saved-note').hidden = !gameState.started
    byId('storage-message').textContent = ''
    showScreen('welcome-screen')
    return true
}

function beginGame() {
    if (resetForUtcDay()) return
    if (!gameState.started) {
        gameState.started = true
        persistState()
        postRequest(gameId, 'start_game').catch(() => {})
    }
    showScreen('game-screen')
    renderClues()
    byId('guess-input').focus()
}

function setError(message) {
    byId('guess-error').textContent = message
    if (message) byId('guess-input').setAttribute('aria-invalid', 'true')
    else byId('guess-input').removeAttribute('aria-invalid')
}

async function finishGame() {
    showScreen('result-screen')
    renderResult()
    byId('result-heading').focus()
    if (gameState.status === 'won' && !matchMedia('(prefers-reduced-motion: reduce)').matches) launchConfetti()
    if (!gameState.completionRecorded) {
        gameState.completionRecorded = true
        persistState()
        const category = gameState.status === 'won' ? `games_with_attempts_${gameState.attempts.length}` : 'games_failed'
        const stats = getStats(gameId)
        stats[category] = (stats[category] || 0) + 1
        statsPopup.updateLocal(stats, category)
        updateStats(gameId, stats, category).then(saved => {
            if (!saved) byId('sync-message').textContent = 'Your result is saved here, but could not sync globally.'
            return statsPopup.update(stats, category)
        })
        window.setTimeout(() => statsPopup.open(), 1500)
    }
}

async function takeTurn(country) {
    if (turnBusy || resetForUtcDay()) return
    const next = applyAttempt(gameState, country, gameState.answer)
    if (next.error) {
        setError(next.error)
        return
    }
    turnBusy = true
    byId('submit-button').disabled = true
    byId('skip-button').disabled = true
    gameState = next.state
    persistState()
    setError('')
    byId('guess-input').value = ''
    byId('suggestions-container').hidden = true
    selectedCountry = null
    renderClues(gameState.status === 'playing' ? gameState.attempts.length : -1)
    if (gameState.status !== 'playing') await finishGame()
    else byId('guess-input').focus()
    turnBusy = false
    byId('submit-button').disabled = false
    byId('skip-button').disabled = false
}

function renderResult() {
    const name = gameState.answer
    const heading = byId('result-heading')
    heading.replaceChildren()
    const flag = document.createElement('img')
    flag.src = countryData[name].flag
    flag.alt = `${name} flag`
    flag.width = 44
    flag.height = 30
    const label = document.createElement('span')
    label.textContent = name
    const title = document.createElement('span')
    title.className = 'result-country'
    title.append(flag, label)
    heading.appendChild(title)
    byId('result-message').textContent = gameState.status === 'won' ? `Solved in ${gameState.attempts.length} ${gameState.attempts.length === 1 ? 'attempt' : 'attempts'}` : `Today's country was ${name}`
    const attempts = byId('result-attempts')
    attempts.replaceChildren()
    for (const attempt of gameState.attempts) {
        const item = document.createElement('li')
        item.textContent = attempt.country === null ? 'Skipped' : `${attempt.country}${attempt.country === name ? ' · Correct' : ' · Incorrect'}`
        attempts.appendChild(item)
    }
    const facts = byId('result-facts')
    facts.replaceChildren()
    const values = clueValues(countryData[name])
    clueLabels.forEach((fact, index) => {
        const card = document.createElement('div')
        card.className = 'result-fact'
        const heading = document.createElement('strong')
        heading.textContent = fact
        const value = document.createElement('div')
        value.textContent = values[index]
        card.append(heading, value)
        facts.appendChild(card)
    })
}

document.querySelector('.home-link').href = siteUrl('home.games')
byId('start-button').addEventListener('click', beginGame)
byId('guess-input').addEventListener('input', () => { selectedCountry = null; setError(''); renderSuggestions() })
byId('guess-input').addEventListener('keydown', event => {
    const list = byId('suggestions-container')
    if (event.key === 'ArrowDown' && !list.hidden) {
        event.preventDefault()
        chooseSuggestion(Math.min(selectedIndex + 1, list.children.length - 1))
        list.hidden = false
        byId('guess-input').setAttribute('aria-expanded', 'true')
        byId('guess-input').setAttribute('aria-activedescendant', list.children[selectedIndex].id)
        list.children[selectedIndex].scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'ArrowUp' && !list.hidden) {
        event.preventDefault()
        chooseSuggestion(Math.max(selectedIndex - 1, 0))
        list.hidden = false
        byId('guess-input').setAttribute('aria-expanded', 'true')
        byId('guess-input').setAttribute('aria-activedescendant', list.children[selectedIndex].id)
        list.children[selectedIndex].scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Escape') {
        list.hidden = true
        byId('guess-input').setAttribute('aria-expanded', 'false')
    }
})
byId('guess-form').addEventListener('submit', event => {
    event.preventDefault()
    if (!selectedCountry) return setError(byId('guess-input').value.trim() ? 'Please select a country from the suggestions.' : 'Choose a country first.')
    takeTurn(selectedCountry)
})
byId('skip-button').addEventListener('click', () => takeTurn(null))
byId('stats-button').addEventListener('click', () => statsPopup.open())

gameState = loadState(currentDay)
if (gameState.status !== 'playing') {
    showScreen('result-screen')
    renderResult()
} else {
    showScreen('welcome-screen')
    byId('saved-note').hidden = !gameState.started
}
