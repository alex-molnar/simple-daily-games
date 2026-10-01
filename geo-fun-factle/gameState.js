import { countryData, countryNames } from '../shared/countryData.js'

const clueFields = ['nationalSport', 'mostVisitedLandmarkCategory', 'country.population', 'nationalAnimal', 'nationalDish', 'mostPopularReligion']

export function hasCompleteClues(record) {
    return Boolean(record && Number.isFinite(record.country?.population) && record.country.population > 0 &&
        clueFields.filter(field => field !== 'country.population').every(field => typeof record[field] === 'string' && record[field].trim().length > 0))
}

export function formatPopulation(population) {
    const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
    for (const [threshold, unit] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) {
        if (population >= threshold) return `${formatter.format(population / threshold)} ${unit}`
    }
    return new Intl.NumberFormat('en-US').format(population)
}

export function applyAttempt(state, country, answer) {
    if (state.status !== 'playing') return { state, error: null }
    if (country !== null && !countryNames.includes(country)) return { state, error: 'Please select a valid country from the suggestions.' }
    if (country !== null && state.attempts.some(attempt => attempt.country === country)) {
        return { state, error: 'You already guessed this country' }
    }
    const attempts = [...state.attempts, { country }]
    const status = country === answer ? 'won' : attempts.length === 6 ? 'lost' : 'playing'
    return { state: { ...state, attempts, status }, error: null }
}
