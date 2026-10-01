import test from 'node:test'
import assert from 'node:assert/strict'
import { countryData } from '../../shared/countryData.js'
import { applyAttempt, formatPopulation, hasCompleteClues } from '../../geo-fun-factle/gameState.js'

const state = () => ({ attempts: [], status: 'playing' })

test('skip consumes a turn, duplicates do not, and a later correct guess wins', () => {
    let game = state()
    game = applyAttempt(game, null, 'France').state
    game = applyAttempt(game, 'Brazil', 'France').state
    const duplicate = applyAttempt(game, 'Brazil', 'France')
    assert.equal(duplicate.error, 'You already guessed this country')
    assert.equal(duplicate.state.attempts.length, 2)
    game = applyAttempt(game, 'France', 'France').state
    assert.equal(game.status, 'won')
    assert.equal(game.attempts.length, 3)
    assert.equal(formatPopulation(68372286), '68.4 million')
})

test('only nonempty facts and a positive finite population make a country eligible', () => {
    assert.equal(hasCompleteClues(countryData.France), true)
    for (const value of [undefined, '', '  ', null]) {
        assert.equal(hasCompleteClues({ ...countryData.France, mostPopularReligion: value }), false)
    }
    for (const population of [undefined, null, 0, -1, Infinity, NaN, '100']) {
        assert.equal(hasCompleteClues({ ...countryData.France, country: { ...countryData.France.country, population } }), false)
    }
})

test('invalid countries and attempts after completion do not change state', () => {
    const original = state()
    assert.equal(applyAttempt(original, 'Atlantis', 'France').state, original)
    const won = applyAttempt(original, 'France', 'France').state
    assert.equal(applyAttempt(won, null, 'France').state, won)
})

test('six skips or wrong guesses lose, while a correct sixth guess wins', () => {
    let skipped = state()
    for (let i = 0; i < 6; i++) skipped = applyAttempt(skipped, null, 'France').state
    assert.equal(skipped.status, 'lost')
    assert.equal(skipped.attempts.length, 6)

    let wrong = state()
    for (const country of ['Brazil', 'Japan', 'India', 'Canada', 'Spain', 'Germany']) {
        wrong = applyAttempt(wrong, country, 'France').state
    }
    assert.equal(wrong.status, 'lost')

    let last = state()
    for (const country of ['Brazil', 'Japan', 'India', 'Canada', 'Spain']) {
        last = applyAttempt(last, country, 'France').state
    }
    last = applyAttempt(last, 'France', 'France').state
    assert.equal(last.status, 'won')
})

test('population formats billions, millions, thousands and grouped small values', () => {
    assert.equal(formatPopulation(1438069596), '1.4 billion')
    assert.equal(formatPopulation(10000), '10 thousand')
    assert.equal(formatPopulation(999), '999')
})
