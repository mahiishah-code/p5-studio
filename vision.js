// =====================================================================
// vision.js — checks whether a model can actually read images. PROVIDED.
//
// The test: draw a random six-digit number into a small PNG, send it to
// the model, and ask it to read the number back. A model that can see
// gets it right; a model that can't will refuse, guess, or error, and a
// guess has a 1-in-900,000 chance of matching.
//
// BayLeaf forwards requests to OpenRouter, and on OpenRouter one model is
// often served by several providers, some of which may not support image
// input even when others do. So the check tries each provider in turn:
// up to (1 + retries) attempts per provider, then on to the next.
//
// Used by vision-check.js (command line) and server.js (MCP tools).
// All logging goes through opts.log; the MCP server sends it to stderr.
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as z from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_BASE_URL = 'https://api.bayleaf.dev/v1';

// ---------------------------------------------------------------------
// Configuration: environment variables, plus a .env file next to this
// script if there is one (the same API-key habit as the first assignment).
// ---------------------------------------------------------------------
export function loadEnv() {
    const file = path.join(__dirname, '.env');
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!m || line.trim().startsWith('#')) continue;
        const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
        if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
}

export function apiSettings() {
    return {
        baseUrl: (process.env.BAYLEAF_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
        apiKey: process.env.BAYLEAF_API_KEY || '',
    };
}

// ---------------------------------------------------------------------
// The test image: six digits in a 5x7 bitmap font, scaled up, black on
// white. Written as a PNG by hand so the check needs no browser and no
// image library.
// ---------------------------------------------------------------------
export const FONT = {
    0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};
export const GLYPH = { scale: 10, gap: 22, margin: 32 };

export function randomTestNumber() {
    // 100000-999999: always six digits, never a leading zero.
    return String(crypto.randomInt(100000, 1000000));
}

export function numberImage(digits) {
    const { scale, gap, margin } = GLYPH;
    const glyphW = 5 * scale, glyphH = 7 * scale;
    const width = margin * 2 + digits.length * glyphW + (digits.length - 1) * gap;
    const height = margin * 2 + glyphH;
    const pixels = Buffer.alloc(width * height, 255); // white, 8-bit grayscale
    [...digits].forEach((d, i) => {
        const x0 = margin + i * (glyphW + gap);
        FONT[d].forEach((row, r) => {
            for (let c = 0; c < 5; c++) {
                if (row[c] !== '1') continue;
                for (let y = 0; y < scale; y++) {
                    const rowStart = (margin + r * scale + y) * width;
                    pixels.fill(0, rowStart + x0 + c * scale, rowStart + x0 + (c + 1) * scale);
                }
            }
        });
    });
    return encodePng(width, height, pixels);
}

function encodePng(width, height, gray) {
    const raw = Buffer.alloc((width + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (width + 1)] = 0; // filter: none
        gray.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8; // bit depth
    header[9] = 0; // color type: grayscale
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', header),
        pngChunk('IDAT', zlib.deflateSync(raw)),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

// ---------------------------------------------------------------------
// Did the reply contain the number? Accept "481203", "The number is
// 481203.", or "481 203"; reject a reply naming a different number.
// ---------------------------------------------------------------------
export function readsNumber(reply, expected) {
    const text = String(reply ?? '');
    const groups = text.match(/\d[\d\s,.]*\d|\d/g) ?? [];
    const candidates = groups.map((g) => g.replace(/[\s,.]/g, '')).filter((g) => g.length >= 4);
    return candidates.length > 0 && candidates.every((c) => c === expected);
}

// ---------------------------------------------------------------------
// Provider list: asks OpenRouter which providers serve the model. BayLeaf
// doesn't route /models/<slug>/endpoints (it answers 404), so on a 404 we
// ask OpenRouter directly; that endpoint is public, so no key is sent.
// If both fail, the caller can name providers explicitly instead.
// ---------------------------------------------------------------------
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export async function listProviders({ model, baseUrl, apiKey }) {
    const slug = model.replace(/^openrouter:/, '');
    let res = await fetch(`${baseUrl}/models/${slug}/endpoints`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        signal: AbortSignal.timeout(20000),
    });
    if (res.status === 404) {
        res = await fetch(`${OPENROUTER_BASE_URL}/models/${slug}/endpoints`, {
            signal: AbortSignal.timeout(20000),
        });
    }
    if (!res.ok) {
        const err = new Error(`provider lookup returned HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    const data = (await res.json()).data ?? {};
    const endpoints = (data.endpoints ?? [])
        .filter((e) => e.tag && (e.status === undefined || e.status === 0))
        .map((e) => ({
            tag: e.tag, name: e.provider_name ?? e.tag,
            contextLength: e.context_length, maxOutput: e.max_completion_tokens,
        }));
    return {
        endpoints,
        acceptsImages: data.architecture?.input_modalities?.includes('image'),
    };
}

// ---------------------------------------------------------------------
// One attempt: send a fresh number, see what comes back.
// ---------------------------------------------------------------------
const PROMPT =
    'This image shows a six-digit number. Reply with only that number, digits only. ' +
    'If you cannot see an image, reply with the single word NONE.';

async function attempt({ model, provider, baseUrl, apiKey }) {
    const expected = randomTestNumber();
    const body = {
        model,
        temperature: 0,
        // Reasoning models spend hidden tokens thinking before they answer, and
        // those count against max_tokens. Too small a budget gives an empty reply.
        max_tokens: 4000,
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: PROMPT },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${numberImage(expected).toString('base64')}` } },
            ],
        }],
    };
    if (provider) body.provider = { only: [provider], allow_fallbacks: false };

    const started = Date.now();
    const result = { expected, provider, ok: false };
    let res;
    try {
        res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(90000),
        });
    } catch (err) {
        return { ...result, ms: Date.now() - started, error: `network: ${err.message}`, retryable: true };
    }
    result.ms = Date.now() - started;
    const text = await res.text();
    if (!res.ok) {
        let message = text.slice(0, 300);
        try { message = JSON.parse(text).error?.message ?? message; } catch { /* keep raw text */ }
        return {
            ...result,
            status: res.status,
            error: `HTTP ${res.status}: ${message}`,
            // Bad key: no provider will do better. Other 4xx: this provider
            // can't do it, so retrying it is pointless. 408/429/5xx: transient.
            fatal: res.status === 401 || res.status === 403,
            retryable: res.status === 408 || res.status === 429 || res.status >= 500,
        };
    }
    let json;
    try { json = JSON.parse(text); } catch {
        return { ...result, error: 'reply was not JSON', retryable: true };
    }
    let reply = json.choices?.[0]?.message?.content ?? '';
    if (Array.isArray(reply)) reply = reply.map((part) => part.text ?? '').join('');
    return {
        ...result,
        reply: String(reply).trim().slice(0, 200),
        finishReason: json.choices?.[0]?.finish_reason,
        servedBy: json.provider, // OpenRouter names the provider that answered, when passed through
        ok: readsNumber(reply, expected),
        retryable: true, // a misread may be a fluke; try a new number
    };
}

// Is the provider that answered the one we asked for? Compare loosely:
// OpenRouter reports "Google AI Studio" for the slug "google-ai-studio".
function sameProvider(servedBy, tag) {
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    return norm(servedBy) === norm(tag.split('/')[0]);
}

// ---------------------------------------------------------------------
// The full check.
//   model        e.g. "openrouter:qwen/qwen3-vl-30b-a3b-instruct"
//   providers    provider slugs to try in order; omit to look them up
//   retries      extra attempts per provider after the first (default 2)
//   testAll      keep going after the first provider passes
//   maxProviders cap on providers tried when they were looked up
// ---------------------------------------------------------------------
export async function checkVision({
    model, providers, retries = 2, testAll = false, maxProviders = 6,
    baseUrl, apiKey, log = () => {},
}) {
    const report = {
        model, baseUrl, usedKey: Boolean(apiKey), rounds: [],
        passed: [], notes: [], routingIgnored: false, routingConfirmed: false,
    };

    let candidates;
    if (providers?.length) {
        candidates = providers.map((tag) => ({ tag, name: tag }));
        report.candidateSource = 'given';
        // Still look providers up, quietly, for their context windows.
        try { report.endpoints = (await listProviders({ model, baseUrl, apiKey })).endpoints; } catch { /* optional */ }
    } else {
        // Start with no provider pinned: that is what Crush does by default.
        candidates = [{ tag: null, name: 'default routing' }];
        report.candidateSource = 'looked up';
        try {
            const found = await listProviders({ model, baseUrl, apiKey });
            report.endpoints = found.endpoints; // context windows are chosen in formatReport
            if (found.acceptsImages === false) {
                report.notes.push('The model catalog says this model does not accept image input at all.');
            }
            if (found.endpoints.length > maxProviders) {
                report.notes.push(`${found.endpoints.length} providers serve this model; testing the first ${maxProviders}. ` +
                    'Name others with --provider to test them.');
            }
            candidates.push(...found.endpoints.slice(0, maxProviders));
            log(`Providers serving ${model}: ${found.endpoints.map((e) => e.tag).join(', ') || '(none listed)'}`);
        } catch (err) {
            if (err.status === 401) {
                report.fatal = 'The API key was rejected (HTTP 401). Check BAYLEAF_API_KEY, or connect to the UCSC network to use Campus Pass.';
                return finish(report);
            }
            report.lookupFailed = true;
            report.notes.push(`Could not list this model's providers (${err.message}), so only default routing ` +
                'was tested. Find provider slugs on the model\'s OpenRouter page and pass them with --provider.');
            log(report.notes.at(-1));
        }
    }

    for (const cand of candidates) {
        const round = { provider: cand.tag, name: cand.name, attempts: [], passed: false };
        report.rounds.push(round);
        for (let i = 0; i <= retries; i++) {
            log(`[${cand.tag ?? 'default'}] attempt ${i + 1} of ${retries + 1}...`);
            const a = await attempt({ model, provider: cand.tag, baseUrl, apiKey });
            round.attempts.push(a);
            if (a.servedBy && cand.tag) {
                if (sameProvider(a.servedBy, cand.tag)) report.routingConfirmed = true;
                else report.routingIgnored = true;
            }
            log(`[${cand.tag ?? 'default'}]   ${a.ok ? 'PASS' : 'fail'}: sent ${a.expected}, ` +
                (a.error ? a.error : `got "${a.reply}"` + (!a.reply && a.finishReason ? ` [finish_reason: ${a.finishReason}]` : '')) + (a.servedBy ? ` (served by ${a.servedBy})` : ''));
            if (a.fatal) {
                report.fatal = a.status === 401
                    ? 'The API key was rejected (HTTP 401). Check BAYLEAF_API_KEY, or connect to the UCSC network to use Campus Pass.'
                    : `Access denied (HTTP ${a.status}): ${a.error}`;
                return finish(report);
            }
            if (a.ok) { round.passed = true; break; }
            if (!a.retryable) break;
            if (i < retries) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
        }
        if (round.passed) {
            report.passed.push(cand.tag);
            if (!testAll) break;
        }
    }
    return finish(report);
}

function finish(report) {
    report.ok = report.passed.length > 0;
    return report;
}

// ---------------------------------------------------------------------
// Human-readable summary, including the crushrc lines to use.
// ---------------------------------------------------------------------
export function formatReport(report) {
    const lines = [`Vision check for ${report.model}`, `API: ${report.baseUrl} (${report.usedKey ? 'API key' : 'no key: UCSC Campus Pass'})`, ''];
    for (const r of report.rounds) {
        const tries = r.attempts.map((a) => (a.ok ? 'pass' : a.status ? `HTTP ${a.status}` : a.error ? 'error' : 'misread')).join(', ');
        lines.push(`${r.passed ? 'PASS' : 'FAIL'}  ${r.provider ?? 'default routing (no provider pinned)'}  [${tries}]`);
        const last = r.attempts.at(-1);
        if (!r.passed && last) lines.push(`      last: ${last.error ?? `sent ${last.expected}, got "${last.reply}"`}`);
    }
    if (report.fatal) {
        lines.push('', report.fatal, '', 'Result: the check could not run.');
        return lines.join('\n');
    }
    for (const note of report.notes) lines.push('', `Note: ${note}`);
    if (report.routingIgnored) {
        lines.push('', 'Warning: a provider other than the one requested answered at least once. ' +
            'BayLeaf may not be passing the provider setting through to OpenRouter, so pinning a provider in Crush may have no effect.');
    }

    lines.push('');
    if (!report.ok) {
        lines.push(report.lookupFailed
            ? 'Result: default routing could not read the image. Test specific providers with --provider, or choose a different model.'
            : 'Result: NO provider read the image correctly. Choose a different model.');
        return lines.join('\n');
    }

    const pinned = report.passed.filter(Boolean);
    const defaultPassed = report.passed.includes(null);
    const somePinnedFailed = report.rounds.some((r) => r.provider && !r.passed);
    // Pin providers when default routing failed, or when we know that some
    // providers of this model can't read images (default routing might pick one).
    const recommendPin = pinned.length > 0 && (!defaultPassed || somePinnedFailed);
    lines.push(`Result: vision works${defaultPassed ? ' with default routing' : ''}${pinned.length ? `${defaultPassed ? ', and' : ''} via ${pinned.join(', ')}` : ''}.`);
    const modelId = report.model;
    // Context window: the SMALLEST among the providers Crush may reach. When
    // pinned, that's the pinned providers; with default routing, OpenRouter
    // may pick any provider of the model. Overstating it lets a long session
    // grow past what the serving provider accepts.
    const reachable = (report.endpoints ?? []).filter((e) => !recommendPin || pinned.includes(e.tag));
    const smallest = (key) => {
        const ns = reachable.map((e) => e[key]).filter((n) => Number.isFinite(n) && n > 0);
        return ns.length ? Math.min(...ns) : undefined;
    };
    const knownCtx = smallest('contextLength');
    const ctx = knownCtx ?? 32000;
    // Max output tokens: the same rule, using each provider's output limit,
    // capped at 32000 (plenty for reasoning plus a sketch) and at half the
    // context window, since input and output share it.
    const knownMaxOut = smallest('maxOutput');
    const maxTokens = knownMaxOut ? Math.min(32000, knownMaxOut, Math.floor(ctx / 2)) : 8000;
    lines.push('', 'Crush setup for this model (in your crushrc):', '');
    const providerLine = [
        'provider add bayleaf --name BayLeaf --type openai-compat \\',
        `  --base-url "${report.baseUrl}" \\`,
        '  --api-key "${BAYLEAF_API_KEY:?set BAYLEAF_API_KEY}"',
    ];
    if (recommendPin) {
        providerLine[providerLine.length - 1] += ' \\';
        providerLine.push(`  --extra-body '${JSON.stringify({ provider: { only: pinned, allow_fallbacks: false } })}'`);
    }
    lines.push(...providerLine, '',
        `model add bayleaf/${modelId} --name "${modelId.replace(/^openrouter:/, '')}" \\`,
        `  --context-window ${ctx} --default-max-tokens ${maxTokens} --supports-images true`,
        '',
        `model large bayleaf/${modelId}`);
    if (!knownCtx) {
        lines.push('', 'The context window (32000 above) is a safe guess; replace it with the number on the model\'s page.');
    }
    if (!knownMaxOut) {
        lines.push('', 'The max tokens (8000 above) is a safe guess; providers didn\'t report their output limits.');
    }
    if (defaultPassed && report.rounds.length === 1) {
        lines.push('', 'Default routing can send requests to any provider of this model. If renders ever come back ' +
            'unread, run this check again with --all to find providers to pin.');
    }
    return lines.join('\n');
}

// =====================================================================
// MCP tools. server.js calls registerVisionTools(server) once.
// =====================================================================
const SELFTEST_TRIES = 3; // the first try plus two retries
let selftest = null;      // { expected, tries } while a test is in progress

export function registerVisionTools(server) {
    loadEnv();

    // -----------------------------------------------------------------
    // check_vision: the same check as `npm run vision-check`, run from
    // the server. It tests a model through BayLeaf directly, so it works
    // even when the agent's own model can't see.
    // -----------------------------------------------------------------
    server.registerTool(
        'check_vision',
        {
            description:
                'Test whether a model can read images through BayLeaf, provider by provider. Sends an image ' +
                'of a random six-digit number and checks the model reads it back; each provider gets up to 3 ' +
                'tries before moving to the next. Reports which providers work and the Crush configuration to ' +
                'use. Takes up to a few minutes. This calls BayLeaf directly, so it does not test your own ' +
                'ability to see; use vision_selftest for that.',
            inputSchema: z.object({
                model: z.string().describe('Model ID as BayLeaf names it, e.g. "openrouter:qwen/qwen3-vl-30b-a3b-instruct"'),
                providers: z.array(z.string()).optional()
                    .describe('OpenRouter provider slugs to test, in order. Omit to try default routing, then each provider of the model.'),
                test_all: z.boolean().default(false).describe('Keep testing providers after the first one passes'),
            }),
        },
        async ({ model, providers, test_all }) => {
            const { baseUrl, apiKey } = apiSettings();
            const report = await checkVision({
                model, providers, testAll: test_all, baseUrl, apiKey,
                maxProviders: 4, // keeps a tool call under a few minutes
                log: (line) => console.error(`[vision] ${line}`),
            });
            return { content: [{ type: 'text', text: formatReport(report) }], isError: !report.ok };
        }
    );

    // -----------------------------------------------------------------
    // vision_selftest: can the agent itself see an image a tool returns?
    // This is the end-to-end test: model, provider, AND Crush's settings.
    // -----------------------------------------------------------------
    server.registerTool(
        'vision_selftest',
        {
            description:
                'Test whether YOU can see images returned by tools. Step 1: call with no answer; the reply ' +
                'contains an image of a six-digit number. Step 2: call again with answer set to the number ' +
                'you read. Never guess: if you cannot see an image, say so instead of calling step 2. If ' +
                'step 1 fails with an error saying the model does not support image data, Crush has your ' +
                'model registered without "--supports-images true".',
            inputSchema: z.object({
                answer: z.string().optional().describe('The six-digit number you read from the image (step 2 only)'),
            }),
        },
        async ({ answer }) => {
            if (answer === undefined) {
                const tries = (selftest?.tries ?? 0) + 1;
                selftest = { expected: randomTestNumber(), tries };
                return {
                    content: [
                        { type: 'text', text: `Vision self-test, try ${tries} of ${SELFTEST_TRIES}. Read the six-digit number ` +
                            'in this image, then call vision_selftest again with answer set to it.' },
                        { type: 'image', data: numberImage(selftest.expected).toString('base64'), mimeType: 'image/png' },
                    ],
                };
            }
            if (!selftest?.expected) {
                return {
                    content: [{ type: 'text', text: 'No image is waiting to be answered. Call vision_selftest with no answer first to get an image.' }],
                    isError: true,
                };
            }
            const { expected, tries } = selftest;
            if (readsNumber(answer, expected)) {
                selftest = null;
                return { content: [{ type: 'text', text: `PASS: the image showed ${expected} and you read ${answer}. You can see tool images.` }] };
            }
            if (tries < SELFTEST_TRIES) {
                selftest = { expected: null, tries }; // next step-1 call issues a fresh number
                return {
                    content: [{ type: 'text', text: `Not a match: the image showed ${expected}, you answered ${answer}. ` +
                        `Call vision_selftest with no answer for a new image (try ${tries + 1} of ${SELFTEST_TRIES}).` }],
                    isError: true,
                };
            }
            selftest = null;
            return {
                content: [{ type: 'text', text: `FAIL: ${SELFTEST_TRIES} tries, none read correctly (last: showed ${expected}, ` +
                    `answered ${answer}). You cannot reliably see tool images with the current model and provider. ` +
                    'Ask the user to run "npm run vision-check" to find a provider that works, or to switch models.' }],
                isError: true,
            };
        }
    );
}
