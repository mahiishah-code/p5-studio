// =====================================================================
// harness.js — runs in the BROWSER, loaded after a sketch and before p5.
//
// It makes every render deterministic and reports when drawing is done.
// Used two ways:
//   1. Headless, by render.js (the MCP server), which sets window.__STUDIO
//      before loading anything.
//   2. Live, by preview.html, which reads ?sketch=...&seed=...&frames=...
//      from the URL.
//
// Students do not need to edit this file.
// =====================================================================
(function () {
    const url = new URLSearchParams(window.location.search);
    const cfg = window.__STUDIO || {
        seed: Number(url.get('seed') ?? 1),
        frames: Number(url.get('frames') ?? 1),
    };

    // A small seeded PRNG (mulberry32). We replace Math.random with it so
    // that even sketches that bypass p5's random() are reproducible.
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    Math.random = mulberry32(cfg.seed);

    // Expose the seed to sketches that want to use it directly.
    window.SEED = cfg.seed;

    window.__renderDone = false;
    const finish = () => { window.__renderDone = true; };

    const userSetup = window.setup;
    const userDraw = window.draw;

    // p5 2.x never calls preload(). Agents trained mostly on p5 1.x code
    // write it constantly, and the resulting error ("cannot read properties
    // of undefined") points at the wrong line. Say what actually happened.
    if (typeof window.preload === 'function') {
        console.error(
            'This sketch defines preload(), which p5.js 2.x never calls. ' +
            'Move that code into setup(), declare setup as async, and await ' +
            'any loads, e.g.  async function setup() { img = await loadImage("a.png"); ... }');
    }

    if (typeof userSetup !== 'function') {
        console.error('Sketch error: no setup() function was defined.');
        finish();
        return;
    }

    // Wrap setup: seed p5's own random() and noise() BEFORE the sketch runs.
    // p5 2.x allows async setup, so we await it.
    window.setup = async function () {
        randomSeed(cfg.seed);
        noiseSeed(cfg.seed);
        try {
            await userSetup();
        } catch (err) {
            finish();   // report the crash right away instead of timing out
            throw err;
        }
        if (typeof userDraw !== 'function') finish(); // a static sketch
    };

    // Wrap draw: stop after the requested number of frames.
    if (typeof userDraw === 'function') {
        window.draw = function () {
            try {
                userDraw();
            } catch (err) {
                noLoop();
                finish();
                throw err;
            }
            // Done when we reach the frame target, or when the sketch
            // stopped itself with noLoop() (a common still-image idiom).
            if (frameCount >= cfg.frames || !isLooping()) {
                noLoop();
                finish();
            }
        };
    }
})();
