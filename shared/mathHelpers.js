export function mathDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const d = R * c; // in metres
    return Math.round(d / 1000)
}

const DIRECTIONS = [
    { directionShort: "N", direction: "north", directionIcon: "⬆️" },
    { directionShort: "NE", direction: "northeast", directionIcon: "↗️" },
    { directionShort: "E", direction: "east", directionIcon: "➡️" },
    { directionShort: "SE", direction: "southeast", directionIcon: "↘️" },
    { directionShort: "S", direction: "south", directionIcon: "⬇️" },
    { directionShort: "SW", direction: "southwest", directionIcon: "↙️" },
    { directionShort: "W", direction: "west", directionIcon: "⬅️" },
    { directionShort: "NW", direction: "northwest", directionIcon: "↖️" },
]

// Compass direction from point 1 to point 2 on a flat map whose east-west edges join up:
// longitude takes the shorter way round the world, latitude does not wrap (no going over a pole).
export function getDirection(lat1, lon1, lat2, lon2) {
    const north = lat2 - lat1
    const east = ((lon2 - lon1 + 540) % 360) - 180 // -180..180
    const bearing = Math.atan2(east, north) * 180/Math.PI // 0 = north, clockwise
    return DIRECTIONS[Math.round(((bearing + 360) % 360) / 45) % 8]
}

export function getRandomSelectionForToday(selections, salt) {
    // Shared daily answers: hash the full UTC date and game name, preserving character order.
    const seed = `${new Date().toISOString().slice(0, 10)}:${salt}`
    let hash = 2166136261
    for (let i = 0; i < seed.length; i++) {
        hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) // FNV-1a
    }
    // MurmurHash3 finalizer spreads small date changes across all 32 bits.
    hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
    hash = (hash ^ (hash >>> 16)) >>> 0
    return selections[Math.floor(hash / 0x100000000 * selections.length)]
}
