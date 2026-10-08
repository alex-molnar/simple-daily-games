import { apiBase } from "./env.js"

export async function sendRequest(gameTitle) {
	if (typeof gameTitle !== "string" || gameTitle.trim().length === 0) {
		throw new Error("gameTitle must be a non-empty string")
	}

    const url = `${apiBase}/games/${gameTitle}/today/stats`
	const response = await fetch(url, { headers: { Accept: "application/json" } })

	if (!response.ok) {
		throw new Error(`Request failed with status ${response.status}`)
	}

    return response.json()
}

export async function postRequest(gameTitle, result, optionalPathPart) {
	if (typeof gameTitle !== "string" || gameTitle.trim().length === 0) {
		throw new Error("gameTitle must be a non-empty string")
	}
	if (typeof result !== "string" || result.trim().length === 0) {
		throw new Error("result must be a non-empty string")
	}

	const amount = result === 'success_game' ? `/${optionalPathPart}` || '' : ''

	const url = `${apiBase}/games/${gameTitle}/today/${result}${amount}`
	// keepalive lets the result reach the API even if the player closes the tab right away.
	const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", keepalive: true })

	if (!response.ok) {
		throw new Error(`Request failed with status ${response.status}`)
	}
}


// Fire and forget: counts a page view for the metrics, and must never get in the way of the page.
export function recordVisit(page) {
	postRequest(page, 'visit').catch(() => {})
}
