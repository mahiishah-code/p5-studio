# p5 Studio

An MCP server that lets an agent write p5.js sketches and **see** the
results. The agent edits files in `sketches/`; the MCP tools render them
headlessly and return the images.

## What's here

| File | What it is | Edit it? |
|---|---|---|
| `server.js` | The MCP server: tool definitions | **Yes, this is your work** |
| `render.js` | Headless rendering engine | No |
| `harness/harness.js` | Seeds randomness, detects when drawing is done | No |
| `preview.html` | Watch a sketch draw live in your browser | No |
| `vision.js` | Vision check and the `check_vision` / `vision_selftest` tools | No |
| `vision-check.js` | Runs the vision check from the command line | No |
| `crushrc.example` | Example Crush configuration for BayLeaf and this server | Copy it |
| `sketches/` | The sketches; `drift.js` is an example | Yes (mostly the agent will) |
| `AGENTS.md` | Standing instructions Crush loads automatically | Yes, as you learn |
| `renders/` | Rendered images (created automatically) | No |

## Setup

```bash
npm install
```

Rendering needs a Chromium-family browser. The server looks, in order,
for Playwright's own Chromium, then an installed Chrome, then Edge, so if
you have Chrome or are on Windows you may need nothing more. If the first
render fails with "Could not start a headless browser", run:

```bash
npm run browser
```

## Watching a sketch live

Open `preview.html` with VS Code's Live Server and add parameters:

```
preview.html?sketch=drift&seed=3&frames=150
```

It uses the same seeding as the headless renderer, so seed 3 here is the
same image the agent sees for seed 3.

## Checking that a model can see

The agent has to look at its renders, so the model must accept images.
Check a model through BayLeaf before configuring Crush with it:

```bash
npm run vision-check -- --model openrouter:<author>/<model>
```

It draws a random six-digit number into a small image and asks the model to
read it back, up to 3 tries per provider. It tries default routing first,
then each OpenRouter provider that serves the model. At the end it prints
the Crush configuration to use, including a provider pin if one is needed.

Options: `--provider SLUG` (repeatable) tests specific providers,
`--all` keeps testing after the first provider passes, and `--retries N`
changes the number of retries (default 2).

It reads `BAYLEAF_API_KEY` from your environment or from a `.env` file in
this folder (see `.env.example`). With no key it relies on UCSC Campus
Pass, which works only on the campus network.

Inside Crush, the server also offers two tools: `check_vision` runs the
same check, and `vision_selftest` checks the agent itself, end to end.

## Connecting to Crush

Crush is configured with a `crushrc` file in your home folder. See
`crushrc.example`: it registers BayLeaf as a provider, your model (with
`--supports-images true`, which is required), and this server. Then start
Crush **from this folder** so it picks up `AGENTS.md`.
