# p5 Studio — notes for the agent

You are working in a studio for generative art made with **p5.js 2.x**.
You write sketches; the `p5-studio` MCP tools render them so you can see
your work.

## How sketches work here

- Each sketch is one file: `sketches/<name>.js`, referred to by name
  without `.js` (e.g. `drift`).
- Global mode only: define `setup()` and optionally `draw()`.
- Every sketch must call `createCanvas(480, 480)`.
- Renders are shown through a **circular mask**, previewing a round
  display. Content in the corners will not be seen.
- **Randomness is seeded for you.** `random()`, `noise()`, and
  `Math.random()` repeat exactly for a given seed. Never call
  `randomSeed()` or `noiseSeed()`; it breaks reproducibility.
- A sketch with `draw()` is captured after `frames` frames (about 60 per
  second). If a sketch builds up over time, render it with more frames.
- Use only p5.js itself. No other libraries, no loading files from the
  internet.

## Judge sketches as a whole

A generative artwork is the algorithm, not any one image. Use
`contact_sheet` to evaluate a design: ask what stays consistent across
seeds (that's the style) and what varies (that's the life). One good seed
proves little.

## p5.js 2.x is not p5.js 1.x

Most p5 code you have seen is 1.x. These changed in 2.x and will fail:

| 1.x (do not use) | 2.x (use this) |
|---|---|
| `function preload() { img = loadImage(...) }` | `async function setup() { img = await loadImage(...); ... }` |
| `curveVertex(x, y)` | `splineVertex(x, y)` |
| `curve(...)` | `spline(...)` |
| `curveTightness(t)` | `splineProperty('tightness', t)` |
| `quadraticVertex(...)` | removed; use `bezierVertex` |

`bezierVertex` still exists but its arguments changed. If curves come out
wrong, check the p5.js 2.x reference rather than assuming 1.x behavior.

When a render reports an error, read it, fix the sketch, and render
again before judging how it looks.

## If you can't see the renders

If a render's image doesn't seem to arrive, or you're unsure you can see
it, run `vision_selftest` before going further. Never describe an image
you have not actually seen.
