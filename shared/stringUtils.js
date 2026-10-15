export function format(str, ...values) {
  return str.replace(/{(\d+)}/g, function(match, index) {
    return typeof values[index] !== 'undefined' ? values[index] : match;
  });
}

export const capitalize = Object.defineProperty(String.prototype, 'capitalize', {
  value: function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
  },
  enumerable: false
});

export const unLe = Object.defineProperty(String.prototype, 'unLe', {
  value: function() {
    return this.replace('ale', 'al').replace('yle', 'y');
  },
  enumerable: false
});
// Names containing the query anywhere (case-insensitive), names starting with it first.
export function matchSolutions(solutions, query) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const lower = name => name.toLowerCase()
  return [
    ...solutions.filter(s => lower(s).startsWith(q)),
    ...solutions.filter(s => !lower(s).startsWith(q) && lower(s).includes(q)),
  ]
}
