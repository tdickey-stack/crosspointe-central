import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({entryPoints:[path.join(root,'src/annual-planner/main.jsx')], outfile:path.join(root,'public/annual-planner.js'), bundle:true,format:'esm',jsx:'automatic',minify:true,legalComments:'external',target:['es2020'],loader:{'.css':'css'}});
