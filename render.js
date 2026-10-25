// =====================================================================
// render.js — headless rendering engine for p5.js sketches. PROVIDED.
//
// Exports:
//   renderSketch({ sketch, seed, frames })   -> one image
//   contactSheet({ sketch, seeds, frames })  -> a grid of images
//   listSketches()                           -> sketch names
//
// Every render opens a fresh browser page, loads the sketch, seeds it,
// lets it draw, and captures the canvas. Anything the sketch prints with
// console.error, and any exception it throws, is collected and returned,
// so the agent can read its own bugs and fix them.
//
// All logging goes to stderr: stdout belongs to MCP.
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SKETCH_DIR = path.join(__dirname, 'sketches');
export const RENDER_DIR = path.join(__dirname, 'renders');
const P5_PATH = path.join(__dirname, 'node_modules', 'p5', 'lib', 'p5.min.js');
const HARNESS_PATH = path.join(__dirname, 'harness', 'harness.js');

// The "display" every sketch is designed for. 480x480 with a circular
// mask previews the round display we will target at the end of the course.
export const DISPLAY = { size: 480, round: true };

// How long one render may take before we capture whatever has been drawn.
// Default 30 seconds; set the RENDER_TIMEOUT_MS environment variable to change it.
const RENDER_TIMEOUT_MS = Number(process.env.RENDER_TIMEOUT_MS) > 0
    ? Number(process.env.RENDER_TIMEOUT_MS)
    : 30000;

// ---------------------------------------------------------------------
// The seeds every contact sheet uses, the same on every run, so sheets of
// different sketches, or different versions of one sketch, compare
// directly. They're spread out rather than 1-9, which avoids testing only
// the low seeds. A sheet of N seeds uses the first N.
// ---------------------------------------------------------------------
export const DEFAULT_SEEDS = [
    3, 17, 42, 101, 256, 1009, 2718, 4096, 7919,
    16180, 27182, 31415, 57721, 99991, 141421, 314159,
];

// ---------------------------------------------------------------------
// Browser: launched once, reused for every render.
// Tries, in order: an explicit path (CHROMIUM_PATH), Playwright's own
// Chromium, then browsers you likely already have installed. Windows
// always has Edge, so most students never need a separate download.
// ---------------------------------------------------------------------
let browserPromise = null;

async function launchBrowser() {
    const attempts = [];
    if (process.env.CHROMIUM_PATH) {
        attempts.push(['CHROMIUM_PATH', { executablePath: process.env.CHROMIUM_PATH }]);
    }
    attempts.push(['playwright chromium', {}]);
    attempts.push(['installed Chrome', { channel: 'chrome' }]);
    attempts.push(['installed Edge', { channel: 'msedge' }]);

    const failures = [];
    for (const [label, opts] of attempts) {
        try {
            const browser = await chromium.launch({ headless: true, ...opts });
            console.error(`[render] using ${label}`);
            return browser;
        } catch (err) {
            failures.push(`${label}: ${err.message.split('\n')[0]}`);
        }
    }
    throw new Error(
        'Could not start a headless browser. Run "npx playwright install chromium" ' +
        'in the project folder, or install Chrome. Details:\n' + failures.join('\n'));
}

function getBrowser() {
    if (!browserPromise) {
        browserPromise = launchBrowser().catch((err) => {
            browserPromise = null; // allow a retry on the next call
            throw err;
        });
    }
    return browserPromise;
}

// ---------------------------------------------------------------------
// Sketch names are plain words like "drift" or "tide-pools", mapping to
// sketches/drift.js. Rejecting anything else keeps a tool call from
// reading files outside the sketches folder.
// ---------------------------------------------------------------------
export function sketchFile(sketch) {
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(sketch)) {
        throw new Error(`Invalid sketch name "${sketch}". Use letters, numbers, - and _ only, without ".js".`);
    }
    const file = path.join(SKETCH_DIR, `${sketch}.js`);
    if (!fs.existsSync(file)) {
        const known = listSketches();
        throw new Error(`No sketch named "${sketch}". Existing sketches: ${known.length ? known.join(', ') : '(none yet)'}.`);
    }
    return file;
}

export function listSketches() {
    if (!fs.existsSync(SKETCH_DIR)) return [];
    return fs.readdirSync(SKETCH_DIR)
        .filter((f) => f.endsWith('.js'))
        .map((f) => f.slice(0, -3))
        .sort();
}

// ---------------------------------------------------------------------
// Render one sketch at one seed.
// ---------------------------------------------------------------------
export async function renderSketch({ sketch, seed = 1, frames = 1 }) {
    const file = sketchFile(sketch);
    const browser = await getBrowser();
    const context = await browser.newContext({
        viewport: { width: DISPLAY.size + 40, height: DISPLAY.size + 40 },
        deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    const warnings = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
        else if (msg.type() === 'warning') warnings.push(msg.text());
    });

    const started = Date.now();
    let timedOut = false;
    try {
        await page.setContent(
            `<html><body style="margin:0;padding:20px;background:#111"></body></html>`);
        // Render settings must exist before the harness runs.
        await page.addScriptTag({
            content: `window.__STUDIO = ${JSON.stringify({ seed, frames })};`,
        });

        // Order matters: sketch defines setup()/draw(), harness wraps them,
        // then p5 finds them and starts global mode.
        try {
            await page.addScriptTag({ content: fs.readFileSync(file, 'utf8') });
        } catch (err) {
            errors.push(`Sketch failed to load: ${err.message.split('\n')[0]}`);
        }
        await page.addScriptTag({ path: HARNESS_PATH });
        await page.addScriptTag({ path: P5_PATH });

        try {
            await page.waitForFunction(() => window.__renderDone === true,
                null, { timeout: RENDER_TIMEOUT_MS });
        } catch {
            timedOut = true;
        }

        const canvas = page.locator('canvas').first();
        if ((await canvas.count()) === 0) {
            errors.push('p5.js never started, so there is no canvas. The sketch probably has a syntax ' +
                'error, or defines neither setup() nor draw().');
            return { sketch, seed, frames, png: null, errors, warnings, timedOut, ms: Date.now() - started };
        }
        // Check the canvas size. p5 quietly makes a 100x100 canvas when setup()
        // never calls createCanvas(), so a missing call would otherwise go unnoticed.
        const box = await canvas.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { w: Math.round(r.width), h: Math.round(r.height) };
        });
        if (box.w === 100 && box.h === 100) {
            errors.push(`The canvas is p5's default 100x100, so setup() never called ` +
                `createCanvas(${DISPLAY.size}, ${DISPLAY.size}). Add that call at the start of setup().`);
        } else if (box.w !== DISPLAY.size || box.h !== DISPLAY.size) {
            errors.push(`The canvas is ${box.w}x${box.h}, but every sketch must use ` +
                `createCanvas(${DISPLAY.size}, ${DISPLAY.size}).`);
        }

        if (DISPLAY.round) {
            await canvas.evaluate((el) => { el.style.clipPath = 'circle(50%)'; });
        }
        const png = await canvas.screenshot({ type: 'png', omitBackground: false });

        fs.mkdirSync(path.join(RENDER_DIR, sketch), { recursive: true });
        const outPath = path.join(RENDER_DIR, sketch, `seed_${String(seed).padStart(6, '0')}.png`);
        fs.writeFileSync(outPath, png);

        return {
            sketch, seed, frames, png, errors, warnings, timedOut,
            ms: Date.now() - started,
            savedTo: path.relative(__dirname, outPath).split(path.sep).join('/'),
        };
    } finally {
        await context.close();
    }
}

// ---------------------------------------------------------------------
// Render one sketch at several seeds and composite a labeled grid.
// In generative art, the artwork is the algorithm: a style lives in what
// stays the same across seeds, so this is the view that matters most.
// ---------------------------------------------------------------------
export async function contactSheet({ sketch, seeds = DEFAULT_SEEDS.slice(0, 9), frames = 1 }) {
    const started = Date.now();
    // Render a few seeds at a time: each gets its own page, so they don't
    // interfere, and a 9-seed sheet finishes several times faster.
    const PARALLEL = 3;
    const results = [];
    for (let i = 0; i < seeds.length; i += PARALLEL) {
        const batch = seeds.slice(i, i + PARALLEL);
        results.push(...await Promise.all(
            batch.map((seed) => renderSketch({ sketch, seed, frames }))));
    }

    const browser = await getBrowser();
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
        const cols = Math.ceil(Math.sqrt(results.length));
        const thumb = 220;
        const cells = results.map((r) => {
            const img = r.png
                ? `<img src="data:image/png;base64,${r.png.toString('base64')}" width="${thumb}" height="${thumb}">`
                : `<div class="fail">no image</div>`;
            return `<figure>${img}<figcaption>seed ${r.seed}${r.errors.length ? ' ⚠' : ''}</figcaption></figure>`;
        }).join('');
        await page.setContent(`
            <html><body style="margin:0;background:#111;font:13px system-ui;color:#aaa">
            <div id="sheet" style="display:inline-block;padding:16px">
              <div style="margin:0 0 10px;color:#eee">${sketch} — ${results.length} seeds</div>
              <div style="display:grid;grid-template-columns:repeat(${cols},${thumb}px);gap:12px">${cells}</div>
            </div>
            <style>
              figure{margin:0;text-align:center}
              figcaption{margin-top:4px}
              .fail{width:${thumb}px;height:${thumb}px;display:flex;align-items:center;justify-content:center;border:1px dashed #555}
            </style></body></html>`);
        const png = await page.locator('#sheet').screenshot({ type: 'png' });

        fs.mkdirSync(path.join(RENDER_DIR, sketch), { recursive: true });
        const outPath = path.join(RENDER_DIR, sketch, 'contact_sheet.png');
        fs.writeFileSync(outPath, png);

        return {
            sketch, png, results,
            ms: Date.now() - started,
            savedTo: path.relative(__dirname, outPath).split(path.sep).join('/'),
        };
    } finally {
        await context.close();
    }
}

// Summarize a render's problems as text the agent can act on.
export function problemReport(results) {
    const lines = [];
    for (const r of results) {
        for (const e of r.errors) lines.push(`seed ${r.seed}: ERROR ${e}`);
        for (const w of r.warnings.slice(0, 3)) lines.push(`seed ${r.seed}: warning ${w}`);
        if (r.timedOut) lines.push(`seed ${r.seed}: did not finish within ${RENDER_TIMEOUT_MS / 1000}s ` +
            `(captured whatever was drawn; check for an infinite loop or a very slow draw())`);
    }
    // Errors usually repeat identically across seeds; collapse duplicates.
    return [...new Set(lines.map((l) => l.replace(/^seed \d+: /, '')))]
        .map((l) => `- ${l}`).join('\n');
}
