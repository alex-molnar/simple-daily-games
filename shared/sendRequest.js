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

export function postRequest(gameTitle, result, optionalPathPart) {
	if (typeof gameTitle !== "string" || gameTitle.trim().length === 0) {
		throw new Error("gameTitle must be a non-empty string")
	}
	if (typeof result !== "string" || result.trim().length === 0) {
		throw new Error("result must be a non-empty string")
	}

	const amount = result === 'success_game' ? `/${optionalPathPart}` || '' : ''

	const url = `${apiBase}/games/${gameTitle}/today/${result}${amount}`
	const request = new XMLHttpRequest()

	// Fire-and-forget request: async mode returns immediately.
	request.open("POST", url, true)
	request.setRequestHeader("Content-Type", "application/json")
	request.send("{}")
}

