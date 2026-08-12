import { capitalize } from 'https://assets.kak.im/api/javascript/stringUtils.js'
import { getRandomSelectionForToday, getDirection, mathDistance } from 'https://assets.kak.im/api/javascript/mathHelpers.js'
import { format } from 'https://assets.kak.im/api/javascript/stringUtils.js'
import { loadGame, getStats, updateStats } from 'https://assets.kak.im/api/javascript/gameHandler.js'
import { launchConfetti } from 'https://assets.kak.im/api/javascript/animations.js'
import { countryData, countryNames } from 'https://assets.kak.im/api/javascript/countryData.js'
import { createStatsPopup } from 'https://assets.kak.im/api/javascript/statsPopup.js'

let gameTitle = PARAM_GAME_TITLE
const validCountries = countryNames.filter(country => countryData[country].flag !== undefined)
let todaysSolutionName = getRandomSelectionForToday(validCountries, gameTitle)
let todaysSolution = countryData[todaysSolutionName]
let stats = getStats(gameTitle)

const explanations = {
    "grayscale": "Guess the country which's flag is displayed in grayscale above. Wrong guesses give you additional hints.",
    "invertedle": "Guess the country which's flag is displayed in inverted rgb scale above. Wrong guesses give you additional hints."
}

function formatGuessItem(name, distance, direction, additionalClassList = "") {
    return format(`
            <div class="guess-item guess-name{3}">{0}</div>
            <div class="guess-item guess-distance{3}">{1}km</div>
            <div class="guess-item guess-direction{3}">{2}</div>
        `, 
        name, 
        distance, 
        direction, 
        ` ${additionalClassList}`
    )
}

function displayRowsCallback(guessName, rowNumber, initial) {
    if (!initial) {
        showFeedbackPopup(guessName)
    }

    if (guessName === todaysSolutionName) {
        displayWinningGuessRow(guessName, rowNumber, initial)
    } else if (rowNumber >= 6) {
        displayNewGuessRow(guessName, rowNumber)
        displayGameOverRow(initial)
    } else {
        displayNewGuessRow(guessName, rowNumber)
    }
}

const gameNavigation = {
    'grayscale': { prev: { url: 'https://countryle.kak.im', label: 'Countryle' }, next: { url: 'https://invertedle.kak.im', label: 'Invertedle' } },
    'invertedle': { prev: { url: 'https://grayscale.kak.im', label: 'Grayscale' }, next: null }
}

function setupNavigation() {
    const nav = gameNavigation[gameTitle]
    if (!nav) return

    const prevEl = document.getElementById('nav-prev')
    const nextEl = document.getElementById('nav-next')

    if (nav.prev) {
        prevEl.href = nav.prev.url
        prevEl.querySelector('.nav-label').textContent = nav.prev.label
    } else {
        prevEl.classList.add('hidden')
    }

    if (nav.next) {
        nextEl.href = nav.next.url
        nextEl.querySelector('.nav-label').textContent = nav.next.label
    } else {
        nextEl.classList.add('hidden')
    }
}

function onLoadGame() {
    setupNavigation()
    loadGame(gameTitle, todaysSolutionName, validCountries, displayRowsCallback)
    document.getElementById("game-description").textContent = explanations[gameTitle] || ""
    document.getElementById("flag-image").src = todaysSolution[gameTitle]
}

function showFeedbackPopup(guess) {
    const overlay = document.getElementById('feedback-overlay')
    const circle = document.getElementById('feedback-circle')
    const flag = document.getElementById('feedback-flag')
    
    // Set the original flag image from local assets
    flag.src = countryData[guess].flag
    
    // Set color based on guess result
    circle.classList.remove('correct', 'wrong')
    circle.classList.add(guess === todaysSolutionName ? 'correct' : 'wrong')
    
    // Show the popup
    overlay.classList.add('show')
    
    // Hide after a delay
    setTimeout(() => {
        overlay.classList.remove('show')
    }, 1200)
}

function displayNewGuessRow(guessName, rowNumber) {
    const guessData = countryData[guessName].country
    const todaysData = todaysSolution.country

    // Calculate distance and direction
    const distance = mathDistance(
        guessData.latitude, guessData.longitude,
        todaysData.latitude, todaysData.longitude
    )

    const directionEmoji = getDirection(Math.atan2(guessData.longitude - todaysData.longitude, guessData.latitude - todaysData.latitude) * 180 / Math.PI).directionIcon

    // Get current active row and fill it
    const currentRow = document.querySelector(`.guess-row[data-row="${rowNumber}"]`)
    currentRow.innerHTML = formatGuessItem(guessName, distance, directionEmoji)
    currentRow.classList.remove("active")
    currentRow.classList.add("filled")

    // Make next row active (if exists)
    const nextRowNumber = rowNumber + 1
    if (nextRowNumber <= 6) {
        const nextRow = document.querySelector(`.guess-row[data-row="${nextRowNumber}"]`)
        nextRow.classList.add("active")
        nextRow.textContent = `Guess ${nextRowNumber} / 6`
    }
}

function displayWinningGuessRow(guessName, rowNumber, initial = false) {
    const guessData = countryData[guessName].country
    const todaysData = todaysSolution.country

    // Get current active row and fill it with winning state
    const currentRow = document.querySelector(`.guess-row[data-row="${rowNumber}"]`)
    currentRow.innerHTML = formatGuessItem(guessName, 0, "🎉", "correct")
    currentRow.classList.remove("active")
    currentRow.classList.add("filled", "correct")

    // Disable input and button
    const guessInput = document.getElementById("guess-input")
    const submitButton = document.getElementById("submit-button")
    
    guessInput.disabled = true
    guessInput.placeholder = "You won!"
    guessInput.value = ""
    submitButton.disabled = true

    launchConfetti()

    if (!initial) {
        stats[`games_with_attempts_${rowNumber}`] = stats[`games_with_attempts_${rowNumber}`] + 1
        updateStats(gameTitle, stats, `games_with_attempts_${rowNumber}`)
    }

    const popup = createStatsPopup(stats, {playerCompletionKey: `games_with_attempts_${rowNumber}`, gameTitle: gameTitle})
    setTimeout(() => popup.open(), 1500)
}

function displayGameOverRow(initial = false) {
    // Create message element above guess rows
    const guessesContainer = document.getElementById("guesses-container")
    const answerMessage = document.createElement("div")
    answerMessage.className = "answer-message"
    answerMessage.textContent = `Today's answer was ${todaysSolutionName}`
    guessesContainer.parentNode.insertBefore(answerMessage, guessesContainer)

    // Disable input and button
    const guessInput = document.getElementById("guess-input")
    const submitButton = document.getElementById("submit-button")
    
    guessInput.disabled = true
    guessInput.placeholder = "Game over!"
    guessInput.value = ""
    submitButton.disabled = true

    if (!initial) {
        stats.games_failed = stats.games_failed + 1
        updateStats(gameTitle, stats, 'games_failed')
    }

    const popup = createStatsPopup(stats, {playerCompletionKey: 'games_failed', gameTitle: gameTitle})
    setTimeout(() => popup.open(), 1500)
}

document.title = gameTitle.capitalize()
window.onload = onLoadGame