const currentDate = new Date().toISOString().split("T")[0];

function toNum(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = hash + str.charCodeAt(i);
    }
    return parseInt((hash / str.length).toFixed(2).replace('.', ''));
}

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
  const seed = parseInt(currentDate.replaceAll("-", "")) + toNum(salt);
  // LCG using GCC's constants
  const m = 0x80000000; // 2**31;
  const a = 1103515245;
  const c = 12345;

  return selections[Math.floor((((a * seed + c) % m) / m) * selections.length)]
}
