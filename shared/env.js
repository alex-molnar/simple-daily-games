// Production runs on capitale.kak.im, the test environment on test.capitale.kak.im.
// A test page must only ever link to and send stats to test, never production.
const labels = location.hostname.split('.')
const isTest = labels[0] === 'test'
const prefix = isTest ? 'test.' : ''

export const gameTitle = labels[isTest ? 1 : 0]
export const apiBase = `https://${prefix}api.games.kak.im`
export const siteUrl = game => `https://${prefix}${game}.kak.im`
