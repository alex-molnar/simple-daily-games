import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

// mathHelpers reads the date once at import, so freeze the clock before importing it.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-01-15T12:00:00Z') })
const { getRandomSelectionForToday, getDirection, mathDistance } = await import('../../shared/mathHelpers.js')

const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']

// Everyone must get the same answer on the same day, so these values must not change silently.
test('getRandomSelectionForToday picks the same answer for a given day and game', () => {
    const picks = ['capitale', 'countryle', 'grayscale', 'invertedle'].map(game => getRandomSelectionForToday(list, game))
    assert.deepEqual(picks, ['b', 'a', 'a', 'd'])
})

test('getRandomSelectionForToday is stable across calls and stays in range', () => {
    for (const salt of ['capitale', 'x', 'a much longer salt']) {
        const pick = getRandomSelectionForToday(list, salt)
        assert.ok(list.includes(pick))
        assert.equal(getRandomSelectionForToday(list, salt), pick)
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
