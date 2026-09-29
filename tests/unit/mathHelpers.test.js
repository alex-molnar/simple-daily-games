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

test('getDirection covers every compass sector and both edges of north', () => {
    const at = angle => getDirection(angle).directionShort
    assert.deepEqual([0, -45, -90, -135, -180, 180, 135, 90, 45].map(at), ['S', 'SE', 'E', 'NE', 'N', 'N', 'NW', 'W', 'SW'])
})

test('mathDistance is in whole kilometres', () => {
    assert.equal(mathDistance(48.8566, 2.3522, 51.5074, -0.1278), 344) // Paris to London
    assert.equal(mathDistance(1, 1, 1, 1), 0)
})
