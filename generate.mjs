// Build-step probe for the Hong Bon static site.
//
// Purpose: prove that Netlify executes a build command before publishing.
// The site has no build step today (publish = "." only). The planned prerender
// generator (indexable category pages, bilingual output) needs a real build, so
// this verifies the pipeline end to end before any of that work depends on it.
//
// This writes a marker file that only exists if the command actually ran; it is
// fetched from a deploy preview to confirm. Replaced by the real generator later.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const info = {
  builtAt: new Date().toISOString(),
  commit: process.env.COMMIT_REF || 'unknown',
  branch: process.env.BRANCH || 'unknown',
  context: process.env.CONTEXT || 'unknown',
  deployId: process.env.DEPLOY_ID || 'unknown',
  node: process.version,
  cwd: process.cwd(),
};

const out = join(here, 'build-probe.txt');
writeFileSync(out, JSON.stringify(info, null, 2) + '\n');
console.log('generate.mjs ran ->', out);
console.log(JSON.stringify(info, null, 2));
