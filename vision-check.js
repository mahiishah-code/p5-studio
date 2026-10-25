#!/usr/bin/env node
// =====================================================================
// vision-check.js — can this model, through BayLeaf, actually see?
//
//   npm run vision-check -- --model openrouter:<author>/<model>
//
// Options:
//   --model ID        model to test (required), as BayLeaf names it
//   --provider SLUG   test this OpenRouter provider (repeatable); without
//                     it, default routing is tried first, then each
//                     provider that serves the model
//   --retries N       extra attempts per provider after the first (default 2)
//   --all             keep testing after the first provider passes
//
// Reads BAYLEAF_API_KEY from the environment or from a .env file in this
// folder. With no key it relies on UCSC Campus Pass (campus network only).
// Exit code: 0 = vision works, 1 = it doesn't, 2 = usage or access error.
// =====================================================================
import { parseArgs } from 'node:util';
import { loadEnv, apiSettings, checkVision, formatReport } from './vision.js';

let args;
try {
    args = parseArgs({
        options: {
            model: { type: 'string' },
            provider: { type: 'string', multiple: true },
            retries: { type: 'string', default: '2' },
            all: { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h', default: false },
        },
    }).values;
} catch (err) {
    console.error(err.message);
    process.exit(2);
}

if (args.help || !args.model) {
    console.error('Usage: npm run vision-check -- --model openrouter:<author>/<model> [--provider SLUG]... [--retries N] [--all]');
    process.exit(args.help ? 0 : 2);
}

const retries = Number(args.retries);
if (!Number.isInteger(retries) || retries < 0 || retries > 5) {
    console.error('--retries must be a whole number from 0 to 5.');
    process.exit(2);
}

loadEnv();
const { baseUrl, apiKey } = apiSettings();
const report = await checkVision({
    model: args.model,
    providers: args.provider,
    retries,
    testAll: args.all,
    baseUrl,
    apiKey,
    log: (line) => console.error(line),
});
console.log('\n' + formatReport(report));
process.exit(report.fatal ? 2 : report.ok ? 0 : 1);
