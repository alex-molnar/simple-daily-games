import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchSolutions } from '../../shared/stringUtils.js'

const names = ['Algeria', 'British Virgin Islands', 'Germany', 'United States Virgin Islands', 'Virginia']

test('matches the query anywhere in the name', () => {
  assert.deepEqual(matchSolutions(names, 'virgin'), ['Virginia', 'British Virgin Islands', 'United States Virgin Islands'])
})

test('ranks names starting with the query first', () => {
  assert.deepEqual(matchSolutions(names, 'ger'), ['Germany', 'Algeria'])
})

test('blank query matches nothing', () => {
  assert.deepEqual(matchSolutions(names, '  '), [])
})
