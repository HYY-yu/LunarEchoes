import { copyFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await rm('dist', { recursive: true, force: true });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'inherit' });
await mkdir('dist', { recursive: true });
await Promise.all(['index.html', 'style.css'].map(file => copyFile(file, `dist/${file}`)));
