import { capitalize, unLe } from 'https://assets.kak.im/api/javascript/stringUtils.js'
import { getRandomSelectionForToday, getDirection, mathDistance } from 'https://assets.kak.im/api/javascript/mathHelpers.js'
import { format } from 'https://assets.kak.im/api/javascript/stringUtils.js'
import { loadGame, getStats, updateStats } from 'https://assets.kak.im/api/javascript/gameHandler.js'
import { launchConfetti } from 'https://assets.kak.im/api/javascript/animations.js'
import { countryData, countryNames } from 'https://assets.kak.im/api/javascript/countryData.js'
import { createStatsPopup } from 'https://assets.kak.im/api/javascript/statsPopup.js'

let five_mil = 5000000
let mil = 1000000
let ten_k = 10000
let k = 1000

let noOfGuesses = 0

const getSolutionNameByGameTitle = {
    'capitale': country => `${country.capital.name} (${country.country.name})`,
    'countryle': country => country.country.name,
}

const getKeyByGameTitle = {
    'capitale': country => country.replace(/.*\(/, "").replace(/\)/, ""),
    'countryle': country => country,
}

let gameTitle = PARAM_GAME_TITLE
let gameTitleUnLe = gameTitle.unLe()
let todaysSolutionCountry = getRandomSelectionForToday(countryNames, gameTitle)
let todaysSolution = countryData[todaysSolutionCountry][gameTitleUnLe]
let todaysSolutionName = getSolutionNameByGameTitle[gameTitle](countryData[todaysSolutionCountry])
let stats = getStats(gameTitle)

const guessTemplate = `
<div class="guess-header">{10}</div>
<div class="guess-row">
    <div class="guess-circle {0}" id="guess-hemisphere">{1}</div>
    <div class="guess-circle {2}" id="guess-continent">{3}</div>
    <div class="guess-circle {4}" id="guess-population">{5}</div>
    <div class="guess-circle {6}" id="guess-distance">{7}</div>
    <div class="guess-circle {8}" id="guess-direction">{9}</div>
</div>`

function formatIframe(name) {
    return format(`
        <div class="solution-iframe-container">
            <iframe 
                src="https://mapy.com/en/turisticka?q={0}&frame=1" 
                title="Solution details"
                class="solution-iframe"
                frameborder="0"
                allowfullscreen>
            </iframe>
        </div>`, 
        name
    );
}

function formatDiff(diff) {
    return format(
        guessTemplate, 
        diff.hemisphereClass, 
        diff.hemisphere, 
        diff.continentClass, 
        diff.continent, 
        diff.populationClass, 
        diff.population, 
        diff.distanceClass, 
        diff.distance, 
        `natural ${diff.directionClass}`, 
        diff.direction,
        diff.guess
    );
}

function formatWinningDiff(diff, no) {
    return format(
        guessTemplate, 
        "good", 
        diff.hemisphere, 
        "good", 
        diff.continent, 
        "good", 
        diff.pretty_population,
        "good",
        "0 km",
        "good",
        "",
        `${no}. ${diff.name}`
    );
}

function getPopulationClass(guessed_population, todays_population) {
    let direction = todays_population > guessed_population ? "north" : "south"

    if (
        (todays_population > five_mil && Math.abs(guessed_population - todays_population) < mil) ||
        (todays_population > mil && Math.abs(guessed_population - todays_population) < 300 * k) ||
        (todays_population > 100 * k && Math.abs(guessed_population - todays_population) < 100 * k) ||
        (todays_population > ten_k && Math.abs(guessed_population - todays_population) < ten_k) ||
        Math.abs(guessed_population - todays_population) < k
    ) {
        return `mid ${direction}`
    } else {
        return `bad ${direction}`
    }
}

function displayRowsCallback(guessName, rowNumber, initial) {
    noOfGuesses = rowNumber
    if (guessName === todaysSolutionName) {
        displayWinningGuessRow(true, initial)
    } else {
        displayNewGuessRow(guessName, rowNumber)
    }
}

function onLoadGame() {
    loadGame(gameTitle, todaysSolutionName, Object.values(countryData).map(country => getSolutionNameByGameTitle[gameTitle](country)), displayRowsCallback)
    document.getElementById("hint-button").addEventListener("click", e => displayWinningGuessRow(false, true))
}

function getDistanceClass(distance) {
    if (distance < 200) {
        return "good"
    } else if (distance < 500) {
        return "mid"
    } else {
        return "bad"
    }
}

function makeScrollable(div) {
    div.style.overflowY = "scroll"
    div.style.paddingRight = "10px"
    document.getElementById("header-container").style.paddingRight = "10px"
    document.getElementById("input-container").style.paddingRight = "10px"
    div.scrollTop = div.scrollHeight
}

function displayNewGuessRow(guess, no) {
    let guessedSolution = countryData[getKeyByGameTitle[gameTitle](guess)][gameTitleUnLe]

    let distance = mathDistance(guessedSolution.latitude, guessedSolution.longitude, todaysSolution.latitude, todaysSolution.longitude)
    let direction = getDirection(Math.atan2(guessedSolution.longitude - todaysSolution.longitude, guessedSolution.latitude - todaysSolution.latitude) * 180 / Math.PI)

    let formattedDiff = formatDiff({
        hemisphereClass: guessedSolution.hemisphere === todaysSolution.hemisphere ? "good" : "bad",
        hemisphere: guessedSolution.hemisphere,
        continentClass: guessedSolution.continent === todaysSolution.continent ? "good" : "bad",
        continent: guessedSolution.continent,
        populationClass: guessedSolution.pretty_population === todaysSolution.pretty_population ? "good" : getPopulationClass(guessedSolution.population, todaysSolution.population),
        population: guessedSolution.pretty_population,
        distanceClass: getDistanceClass(distance),
        distance: `${distance} km`, 
        directionClass: direction.direction,
        direction: direction.directionShort,
        guess: `${no}. ${guess}`
    })
    let container = document.getElementById("guesses-container")
    container.insertAdjacentHTML('beforeend', formattedDiff)
    let newRow = container.lastElementChild
    if (newRow && newRow.classList.contains('guess-row')) {
        newRow.classList.add('new')
        setTimeout(() => newRow.classList.remove('new'), 1000)
    }

    if(noOfGuesses > 4) {
        let scroller = document.getElementById("guesses-container")
        makeScrollable(scroller)
    }
}

function getCategory(successful){
    if (successful && noOfGuesses > 6) {
        return "games_with_attempts_plus"
    } else if (successful) {
        return `games_with_attempts_${noOfGuesses}`
    } else {
        return "games_failed"
    }
}

function displayWinningGuessRow(triggerConfetti = false, initial = false) {
    let formattedDiff = formatWinningDiff(todaysSolution, noOfGuesses)
    let container = document.getElementById("guesses-container")
    container.insertAdjacentHTML('beforeend', formattedDiff)
    let newRow = container.lastElementChild
    if (newRow && newRow.classList.contains('guess-row')) {
        newRow.classList.add('new')
        setTimeout(() => newRow.classList.remove('new'), 1000)
    }
    
    container.insertAdjacentHTML('beforeend', formatIframe(todaysSolutionName))
    
    if(noOfGuesses > 4) {
        let scroller = document.getElementById("guesses-container")
        makeScrollable(scroller)
    }
    
    document.getElementById('guess-input').disabled = true;
    document.getElementById('guess-input').style.cursor = "not-allowed";
    document.getElementById('submit-button').disabled = true;
    document.getElementById('submit-button').style.cursor = "not-allowed";
    document.getElementById('hint-button').disabled = true;
    document.getElementById('hint-button').style.cursor = "not-allowed";
    
    if (triggerConfetti) {
        launchConfetti()
    } 

    let category = getCategory(triggerConfetti)

    if (!initial) {
        stats[category] = stats[category] + 1
        updateStats(gameTitle, stats)
    }

    const popup = createStatsPopup(stats, {playerCompletionKey: category})
    setTimeout(() => popup.open(), 1500)
}

document.title = `${gameTitle.capitalize()} v2`
window.onload = onLoadGame
