import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { countryData, countryNames } from '../../shared/countryData.js'

// Pin the daily schedule so these checks do not depend on the test run's date.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-01-15T12:00:00Z') })
const { getRandomSelectionForToday, getDirection, mathDistance } = await import('../../shared/mathHelpers.js')

const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']

// Everyone must get the same answer on the same day, so these values must not change silently.
test('getRandomSelectionForToday picks the same answer for a given day and game', () => {
    const picks = ['capitale', 'countryle', 'grayscale', 'invertedle'].map(game => getRandomSelectionForToday(list, game))
    assert.deepEqual(picks, ['i', 'c', 'g', 'b'])
})

test('getRandomSelectionForToday is stable across calls and stays in range', () => {
    for (const salt of ['capitale', 'x', 'a much longer salt']) {
        const pick = getRandomSelectionForToday(list, salt)
        assert.ok(list.includes(pick))
        assert.equal(getRandomSelectionForToday(list, salt), pick)
    }
})

test('daily flag answers do not repeat the September 30 / October 2 pair', () => {
    const countries = countryNames.filter(name => countryData[name].flag !== undefined)
    try {
        for (const game of ['grayscale', 'invertedle']) {
            mock.timers.setTime(Date.parse('2026-09-30T12:00:00Z'))
            const previous = getRandomSelectionForToday(countries, game)
            mock.timers.setTime(Date.parse('2026-10-02T12:00:00Z'))
            assert.notEqual(getRandomSelectionForToday(countries, game), previous)
        }
    } finally {
        mock.timers.setTime(Date.parse('2026-01-15T12:00:00Z'))
    }
})

test('daily selection uses the full game name and changes at UTC calendar boundaries', () => {
    const choices = Array.from({ length: 65536 }, (_, index) => index)
    try {
        assert.notEqual(getRandomSelectionForToday(choices, 'abc'), getRandomSelectionForToday(choices, 'cba'))
        for (const day of ['2026-09-30', '2026-12-31', '2028-02-29']) {
            mock.timers.setTime(Date.parse(`${day}T00:00:00Z`))
            const first = getRandomSelectionForToday(choices, 'grayscale')
            mock.timers.setTime(Date.parse(`${day}T23:59:59.999Z`))
            assert.equal(getRandomSelectionForToday(choices, 'grayscale'), first)
            mock.timers.tick(1)
            assert.notEqual(getRandomSelectionForToday(choices, 'grayscale'), first)
        }
    } finally {
        mock.timers.setTime(Date.parse('2026-01-15T12:00:00Z'))
    }
})

test('getDirection points along the compass from guess to target', () => {
    const at = (lat, lon) => getDirection(0, 0, lat, lon).directionShort
    assert.deepEqual([[10, 0], [10, 10], [0, 10], [-10, 10], [-10, 0], [-10, -10], [0, -10], [10, -10]].map(([a, b]) => at(a, b)),
        ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
})

test('getDirection wraps across the antimeridian', () => {
    assert.equal(getDirection(-17.7, 178, -17.5, -149.4).directionShort, 'E') // Fiji to French Polynesia
    assert.equal(getDirection(-17.5, -149.4, -17.7, 178).directionShort, 'W')
    assert.equal(getDirection(0, 179, 0, -179).directionShort, 'E')
})

test('getDirection never wraps over a pole', () => {
    assert.equal(getDirection(-17.7, 178, 17.6, 8.1).directionShort, 'W') // Fiji to Niger: north of Fiji, not south
    assert.equal(getDirection(80, 0, 75, 10).directionShort, 'SE') // near the pole, still south of where we were
    assert.equal(getDirection(-80, 0, -75, -10).directionShort, 'NW')
})

test('mathDistance is in whole kilometres', () => {
    assert.equal(mathDistance(48.8566, 2.3522, 51.5074, -0.1278), 344) // Paris to London
    assert.equal(mathDistance(1, 1, 1, 1), 0)
})
