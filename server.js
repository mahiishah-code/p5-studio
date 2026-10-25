// =====================================================================
// server.js — the p5 Studio MCP server. THIS IS THE FILE YOU WRITE.
//
// The hard rendering work lives in render.js (provided). Your job is to
// expose it to the agent as well-described MCP tools. The tool
// description is the agent's only manual: anything it doesn't say, the
// agent doesn't know.
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

// ---------------------------------------------------------------------
// Tool 1: list_sketches — DONE, as a worked example.
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
// Tool 2: render_sketch — TODO
//
// Inputs:  sketch (string), seed (integer, default 1),
//          frames (integer, default 1: how many frames of draw() to run)
//
// Call:    const r = await renderSketch({ sketch, seed, frames });
//
// r.png       a Buffer holding the PNG, or null if no canvas was made
// r.errors    array of error messages from the sketch
// r.warnings  array of warning messages
// r.timedOut  true if the sketch never finished
// r.ms        render time in milliseconds
// r.savedTo   where the PNG was saved, e.g. "renders/drift/seed_000001.png"
//
// problemReport([r]) turns errors/warnings/timeouts into readable text.
//
// Return BOTH a text block (what happened, where it was saved, any
// problems) AND an image block:
//     { type: 'image', data: r.png.toString('base64'), mimeType: 'image/png' }
// Set isError: true when r.errors is not empty. Wrap everything in
// try/catch: renderSketch throws for unknown or invalid sketch names.
//
// The description matters most. The agent needs to know: where sketches
// live and how they're named, that the canvas must be
// DISPLAY.size x DISPLAY.size, that renders are shown in a circle, that
// seeding is automatic (so it must NOT call randomSeed/noiseSeed), and
// when to raise frames.
// ---------------------------------------------------------------------


// ---------------------------------------------------------------------
// Tool 3: contact_sheet — TODO
//
// Inputs:  sketch, count (how many seeds, default 9), frames (default 1)
//
// Call:    const seeds = DEFAULT_SEEDS.slice(0, count);   // same seeds every time
//          const sheet = await contactSheet({ sketch, seeds, frames });
//
// sheet.png      a Buffer holding the grid image
// sheet.results  an array of per-seed results, shaped like r above
// sheet.savedTo  where the grid was saved
// sheet.ms       total time in milliseconds
//
// Return a text summary (use problemReport(sheet.results)) and the image.
// List the seeds in the summary, so the agent can render any one of them
// at full size with render_sketch.
//
// In the description, tell the agent WHY this tool exists: a generative
// artwork is the algorithm, not one output, so the agent should judge a
// sketch by what stays consistent across seeds. Nudge it to prefer this
// tool over render_sketch when evaluating a design.
// ---------------------------------------------------------------------


async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('p5 studio MCP server running.');
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
