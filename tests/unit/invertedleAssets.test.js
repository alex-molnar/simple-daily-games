import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

// Palette-mode flags once came out solid black because the inversion ran on palette indices, not colours.
const check = `
from PIL import Image, ImageChops
import os
bad = []
for f in sorted(os.listdir('assets/original')):
    inv = Image.open(f'assets/invertedle/{f}').convert('RGB')
    exp = ImageChops.invert(Image.open(f'assets/original/{f}').convert('RGB'))
    if inv.size != exp.size or ImageChops.difference(inv, exp).getbbox(): bad.append(f)
print(','.join(bad))
`

test('every invertedle flag is the colour inverse of its original', t => {
  const r = spawnSync('python3', ['-I', '-c', check], { encoding: 'utf8' })
  if (r.status !== 0) return t.skip('python3 with Pillow not available')
  assert.equal(r.stdout.trim(), '')
})
