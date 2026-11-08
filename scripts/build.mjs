import { copyFile, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { embedDesertOpening } from './desert-opening.mjs';
await rm('dist', { recursive: true, force: true });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'inherit' });
await mkdir('dist', { recursive: true });
const html = embedDesertOpening(await readFile('index.html', 'utf8'), JSON.parse(await readFile('content/desert-base.story.json', 'utf8')));
await Promise.all([writeFile('dist/index.html', html), copyFile('style.css', 'dist/style.css')]);
