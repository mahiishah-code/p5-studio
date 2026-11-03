// =====================================================================
// server.js — the p5 Studio MCP server.
//
// This is the part you write. The hard rendering work lives in render.js
// (provided); your job is to expose it to the agent as well-described
// MCP tools. Remember: the tool description is the agent's only manual.
//
// Reminder from the MCP assignment: stdout belongs to MCP.
// Log with console.error, never console.log.
// =====================================================================
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod';
import { renderSketch, contactSheet, listSketches, problemReport, DEFAULT_SEEDS, DISPLAY } from './render.js';
import { registerVisionTools } from './vision.js';

const server = new McpServer({ name: 'p5-studio', version: '1.0.0' });

// Provided: check_vision and vision_selftest (see vision.js). Leave this in.
registerVisionTools(server);

const SKETCH_RULES =
    `Sketches are p5.js 2.x files in the sketches/ folder, named like sketches/drift.js, ` +
    `and referred to by name without ".js" (e.g. "drift"). Each must call ` +
    `createCanvas(${DISPLAY.size}, ${DISPLAY.size}) in setup(). Renders are shown through a ` +
    `circular mask, previewing a round display, so keep important content inside the circle. ` +
    `Randomness is seeded automatically: random(), noise(), and Math.random() all repeat ` +
    `exactly for the same seed, so never call randomSeed() or noiseSeed() yourself.`;

// ---------------------------------------------------------------------
// Tool 1: list_sketches
// ---------------------------------------------------------------------
server.registerTool(
    'list_sketches',
    {
        description: 'List the names of all p5.js sketches in the sketches/ folder.',
        inputSchema: z.object({}),
    },
    async () => {
        const names = listSketches();
        return {
            content: [{
                type: 'text',
                text: names.length ? names.join('\n') : 'No sketches yet. Create one in sketches/<name>.js.',
            }],
        };
    }
);

// ---------------------------------------------------------------------
// Tool 2: render_sketch — one seed, one image
// ---------------------------------------------------------------------
server.registerTool(
    'render_sketch',
    {
        description:
            'Render a p5.js sketch at one seed and return the image so you can see it. ' +
            'Any errors the sketch throws are reported in the reply; fix them before judging the image. ' +
            'For sketches that build up over time (trails, growth, accumulation), raise frames: ' +
            'the image is captured after that many frames of draw(). ' + SKETCH_RULES,
        inputSchema: z.object({
            sketch: z.string().describe('Sketch name, e.g. "drift" for sketches/drift.js'),
            seed: z.number().int().min(0).default(1).describe('Random seed; the same seed always gives the same image'),
            frames: z.number().int().min(1).max(600).default(1)
                .describe('How many frames of draw() to run before capturing (about 60 per second)'),
        }),
    },
    async ({ sketch, seed, frames }) => {
        try {
            const r = await renderSketch({ sketch, seed, frames });
            const problems = problemReport([r]);
            const summary =
                `Rendered "${sketch}" seed ${seed}, ${frames} frame(s), in ${r.ms} ms.` +
                (r.savedTo ? ` Saved ${r.savedTo}.` : '') +
                (problems ? `\nProblems:\n${problems}` : '\nNo errors.');
            const content = [{ type: 'text', text: summary }];
            if (r.png) {
                content.push({ type: 'image', data: r.png.toString('base64'), mimeType: 'image/png' });
            }
            // A blank canvas from a crashed sketch is still a failure.
            return { content, isError: !r.png || r.errors.length > 0 };
        } catch (err) {
            return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
        }
    }
);

// ---------------------------------------------------------------------
// Tool 3: contact_sheet — many seeds, one grid
// ---------------------------------------------------------------------
server.registerTool(
    'contact_sheet',
    {
        description:
            'Render a p5.js sketch at several seeds and return one grid image of all of them. ' +
            'Use this to judge a generative sketch as a whole: the artwork is the algorithm, not any ' +
            'single output, so look at what stays consistent and what varies across seeds. ' +
            'Prefer this over render_sketch when evaluating a design. Every sheet uses the same seeds, ' +
            'so sheets of two versions of a sketch compare directly. ' + SKETCH_RULES,
        inputSchema: z.object({
            sketch: z.string().describe('Sketch name, e.g. "drift" for sketches/drift.js'),
            count: z.number().int().min(2).max(DEFAULT_SEEDS.length).default(9)
                .describe('Number of seeds to render; always the same seeds, in the same order'),
            frames: z.number().int().min(1).max(600).default(1)
                .describe('How many frames of draw() to run before capturing each seed'),
        }),
    },
    async ({ sketch, count, frames }) => {
        try {
            const seeds = DEFAULT_SEEDS.slice(0, count);
            const sheet = await contactSheet({ sketch, seeds, frames });
            const problems = problemReport(sheet.results);
            const summary =
                `Contact sheet for "${sketch}", ${seeds.length} seeds, ${frames} frame(s) each, ` +
                `in ${sheet.ms} ms. Saved ${sheet.savedTo}.\nSeeds, left to right and top to bottom: ` +
                `${seeds.join(', ')}. To see one at full size, use render_sketch with that seed.` +
                (problems ? `\nProblems:\n${problems}` : '\nNo errors.');
            return {
                content: [
                    { type: 'text', text: summary },
                    { type: 'image', data: sheet.png.toString('base64'), mimeType: 'image/png' },
                ],
                isError: sheet.results.some((r) => !r.png || r.errors.length > 0),
            };
        } catch (err) {
            return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
        }
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('p5 studio MCP server running.');
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
