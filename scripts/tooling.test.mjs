import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, readdir, rm, copyFile, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('.', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(read, label) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    try { const value = await read(); if (value) return value; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await pause(10);
  }
  throw new Error('Timed out waiting for ' + label);
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lunar-tooling-test-'));
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'test'));
  await mkdir(join(root, '.audit'));
  await writeFile(join(root, '.gitignore'), '.audit\ndist\n');
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await writeFile(join(root, 'input.txt'), 'first');
  await Promise.all(['task.mjs', 'build.mjs', 'check.mjs', 'serve.mjs', 'simulate.mjs'].map(file => copyFile(join(source, file), join(root, 'scripts', file))));
  await writeFile(join(root, 'scripts', 'task-steps.mjs'), `import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join} from 'node:path';
export async function build(context){await mkdir('dist',{recursive:true}); await context.execute('fixture-build',['--input-type=module','-e',\`import {readFile,writeFile} from 'node:fs/promises'; import {existsSync} from 'node:fs'; import {spawn} from 'node:child_process'; await writeFile('.audit/build.ready',String(process.pid)); if(existsSync('.audit/grandchild')){const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); await writeFile('.audit/grandchild.pid',String(child.pid));} while(existsSync('.audit/hold')&&!existsSync('.audit/release'))await new Promise(r=>setTimeout(r,10)); if(existsSync('.audit/fail'))process.exit(7); await writeFile('dist/value.txt',await readFile('input.txt')); console.log(existsSync('.audit/log-flood')?'x'.repeat(50000):'fixture.build.output');\`]);}
export async function check(context){context.info({event:'fixture.check'});}
export async function simulate(context){context.info({event:'fixture.simulate'});}
export async function serve(root,context){const server=createServer(async(req,res)=>{res.end(await readFile(join(root,'value.txt')))}); context.setServer(server); await new Promise((resolve,reject)=>{server.once('close',resolve);server.once('error',reject);server.listen(0,'127.0.0.1',()=>context.info({event:'server.started',url:'http://127.0.0.1:'+server.address().port}));});}
`);
  await writeFile(join(root, 'test', 'finite.test.mjs'), `import test from 'node:test'; import assert from 'node:assert/strict'; import {writeFile} from 'node:fs/promises'; import {existsSync} from 'node:fs'; test('finite fixture consumer',async()=>{await writeFile('.audit/test.ready',String(process.pid));while(existsSync('.audit/test.hold')&&!existsSync('.audit/test.release'))await new Promise(r=>setTimeout(r,10));assert.equal(1,1);});`);
  await writeFile(join(root, 'scripts', 'tooling.test.mjs'), `import test from 'node:test';import assert from 'node:assert/strict';test('finite nonrecursive tooling fixture',()=>assert.equal(1,1));`);
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, '-c', 'user.name=Tooling fixture', '-c', 'user.email=tooling@example.invalid', 'commit', '-qm', 'fixture']);
  const processes = [];
  t.after(async () => {
    for (const process of processes) if (!process.exited) process.child.kill('SIGTERM');
    await Promise.race([Promise.all(processes.map(process => process.done)), pause(3000)]);
    for (const process of processes) if (!process.exited) process.child.kill('SIGKILL');
    await Promise.all(processes.map(process => process.done));
    await rm(root, { recursive: true, force: true });
  });
  function start(command, direct = false, options = {}) {
    const install = options.alias || root;
    const args = direct ? [join(install, 'scripts', command + '.mjs')] : [join(install, 'scripts', 'task.mjs'), command];
    const fd = options.outputPath ? openSync(options.outputPath, 'w') : null;
    const executable = options.limit ? 'sh' : process.execPath;
    const invocation = options.limit ? ['-c', 'ulimit -c 0; ulimit -f 8; exec "$@"', 'fixture', process.execPath, ...args] : args;
    const child = spawn(executable, invocation, { cwd: options.cwd || root, stdio: ['ignore', fd ?? 'pipe', fd ?? 'pipe'] });
    if (fd !== null) closeSync(fd);
    const run = { child, exited: false, stdout: '', stderr: '' };
    child.stdout?.on('data', data => { run.stdout += data; });
    child.stderr?.on('data', data => { run.stderr += data; });
    run.done = new Promise(resolve => child.once('close', (code, signal) => { run.exited = true; resolve({ code, signal }); }));
    processes.push(run);
    return run;
  }
  async function receipts() {
    const dirs = await readdir(join(root, '.audit', 'runs'));
    return Promise.all(dirs.map(async dir => ({ directory: join(root, '.audit', 'runs', dir), value: JSON.parse(await readFile(join(root, '.audit', 'runs', dir, 'result.json'), 'utf8')) })));
  }
  return { root, start, receipts, flag: name => writeFile(join(root, '.audit', name), ''), ready: name => waitFor(() => readFile(join(root, '.audit', name), 'utf8'), name) };
}

test('whole verify transaction rejects a direct builder while its consumer runs, with separate truthful evidence', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  await f.flag('test.hold');
  const first = f.start('verify');
  await waitFor(async () => {
    if (first.exited) throw new Error(first.stderr + first.stdout);
    return readFile(join(f.root, '.audit', 'test.ready'), 'utf8');
  }, 'fixture verify consumer');
  const second = f.start('build', true);
  assert.deepEqual(await second.done, { code: 75, signal: null });
  await f.flag('test.release');
  assert.deepEqual(await first.done, { code: 0, signal: null });
  const receipts = await f.receipts();
  assert.equal(receipts.length, 2);
  const successful = receipts.find(run => run.value.command === 'verify');
  const busy = receipts.find(run => run.value.command === 'build');
  assert.notEqual(successful.directory, busy.directory);
  assert.deepEqual(successful.value.steps.map(step => step.name), ['build', 'test', 'build', 'check', 'simulate', 'tooling']);
  assert.equal(busy.value.outcome.kind, 'busy');
  assert.equal(busy.value.outcome.ownerRun, successful.value.runId);
  assert.equal(successful.value.sourceBefore.head, execFileSync('git', ['-C', f.root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
  assert.equal(successful.value.sourceBefore.dirty, false);
  assert.deepEqual(successful.value.sourceBefore, successful.value.sourceAfter);
  assert.match(await readFile(successful.value.stdoutPath, 'utf8'), /fixture.build.output/);
  assert.match(await readFile(successful.value.stdoutPath, 'utf8'), /finite fixture consumer/);
  assert.match(await readFile(successful.value.stdoutPath, 'utf8'), /finite nonrecursive tooling fixture/);
  assert.match(await readFile(busy.value.stderrPath, 'utf8'), /task.workspace_busy/);
  assert.notEqual(successful.value.stdoutPath, busy.value.stdoutPath);
});

test('same-workspace builds refuse overlap while independent workspaces enter real child work together', { timeout: 30000 }, async t => {
  const a = await fixture(t), b = await fixture(t);
  await a.flag('hold');
  await b.flag('hold');
  const first = a.start('build'), independent = b.start('build');
  const [pidA, pidB] = await Promise.all([a.ready('build.ready'), b.ready('build.ready')]);
  assert.notEqual(pidA, pidB);
  assert.equal(first.exited, false);
  assert.equal(independent.exited, false);
  const busy = a.start('build');
  assert.equal((await busy.done).code, 75);
  await a.flag('release');
  await b.flag('release');
  assert.equal((await first.done).code, 0);
  assert.equal((await independent.done).code, 0);
});

test('real child failure is retained and releases the transaction for the next invocation', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  await f.flag('fail');
  assert.equal((await f.start('build').done).code, 7);
  await rm(join(f.root, '.audit', 'fail'));
  assert.equal((await f.start('build').done).code, 0);
  const receipts = await f.receipts();
  const failed = receipts.find(run => run.value.outcome.code === 7).value;
  assert.equal(failed.children[0].code, 7);
  assert.equal(failed.steps[0].code, undefined);
});

for (const signal of ['SIGINT', 'SIGTERM']) test(signal + ' ends actual descendants before releasing the workspace', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  await f.flag('hold');
  await f.flag('grandchild');
  const run = f.start('build');
  const child = Number(await f.ready('build.ready'));
  const grandchild = Number(await f.ready('grandchild.pid'));
  run.child.kill(signal);
  assert.deepEqual(await run.done, { code: null, signal });
  for (const pid of [child, grandchild]) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  await rm(join(f.root, '.audit', 'hold'));
  await rm(join(f.root, '.audit', 'grandchild'));
  assert.equal((await f.start('build').done).code, 0);
  const receipts = await f.receipts();
  assert.equal(receipts.find(row => row.value.outcome.kind === 'signalled').value.outcome.signal, signal);
});

test('changing real inputs cannot produce a successful exact-source receipt', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  await f.flag('hold');
  const run = f.start('build');
  await f.ready('build.ready');
  await writeFile(join(f.root, 'input.txt'), 'changed');
  await f.flag('release');
  assert.equal((await run.done).code, 1);
  const [receipt] = await f.receipts();
  assert.equal(receipt.value.outcome.kind, 'tool-error');
  assert.notEqual(receipt.value.sourceBefore.inputDigest, receipt.value.sourceAfter.inputDigest);
  assert.equal(receipt.value.sourceAfter.dirty, true);
});

test('dev serves its immutable snapshot without holding the build transaction', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  const dev = f.start('dev');
  const url = await waitFor(() => {
    const lines = dev.stdout.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } });
    return lines.find(line => line?.event === 'server.started')?.url;
  }, 'dev server');
  assert.equal(await (await fetch(url)).text(), 'first');
  await writeFile(join(f.root, 'input.txt'), 'second');
  assert.equal((await f.start('build').done).code, 0);
  assert.equal(await readFile(join(f.root, 'dist', 'value.txt'), 'utf8'), 'second');
  assert.equal(await (await fetch(url)).text(), 'first');
  dev.child.kill('SIGTERM');
  assert.deepEqual(await dev.done, { code: null, signal: 'SIGTERM' });
});

test('unknown transaction ownership blocks every direct CLI before touching dist', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  const lock = join(f.root, '.audit', 'dist-transaction');
  await mkdir(lock);
  for (const command of ['build', 'check', 'simulate', 'serve']) assert.equal((await f.start(command, true).done).code, 75);
  await assert.rejects(readFile(join(f.root, 'dist', 'value.txt')), { code: 'ENOENT' });
  const receipts = await f.receipts();
  assert.equal(receipts.length, 4);
  for (const receipt of receipts) assert.deepEqual(receipt.value.outcome, { kind: 'busy', ownerRun: null, code: 75 });
  await rm(lock, { recursive: true });
  assert.equal((await f.start('build').done).code, 0);
});

test('overwriting one external terminal log cannot merge the two owned run logs', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  const external = join(f.root, '.audit', 'shared-terminal.log');
  await f.flag('hold');
  const first = f.start('build', false, { outputPath: external });
  await f.ready('build.ready');
  const second = f.start('build', false, { outputPath: external });
  assert.equal((await second.done).code, 75);
  await f.flag('release');
  assert.equal((await first.done).code, 0);
  const receipts = await f.receipts();
  const success = receipts.find(row => row.value.outcome.code === 0).value;
  const busy = receipts.find(row => row.value.outcome.code === 75).value;
  assert.notEqual(success.stdoutPath, busy.stdoutPath);
  assert.match(await readFile(success.stdoutPath, 'utf8'), /fixture.build.output/);
  assert.match(await readFile(busy.stderrPath, 'utf8'), /task.workspace_busy/);
});

test('failure to persist the terminal result is nonzero and cannot leave a successful receipt', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  await f.flag('hold');
  const run = f.start('build');
  await f.ready('build.ready');
  const [id] = await readdir(join(f.root, '.audit', 'runs'));
  const directory = join(f.root, '.audit', 'runs', id);
  await mkdir(join(directory, 'result.json'));
  await f.flag('release');
  assert.equal((await run.done).code, 1);
  assert.match(run.stderr, /task.result_failed/);
  await assert.rejects(readFile(join(directory, 'result.json')), { code: 'EISDIR' });
  assert.equal((await f.start('build').done).code, 0);
});

test('real log storage exhaustion cannot be reported as success', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  await f.flag('log-flood');
  const run = f.start('build', false, { limit: true });
  const closed = await run.done;
  assert.notEqual(closed.code, 0);
  const directories = await readdir(join(f.root, '.audit', 'runs'));
  assert.equal(directories.length, 1);
  try {
    const result = JSON.parse(await readFile(join(f.root, '.audit', 'runs', directories[0], 'result.json'), 'utf8'));
    assert.notEqual(result.outcome.code, 0);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
});

test('SIGKILL leaves conservative ownership rather than stealing a possibly orphaned writer', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  await f.flag('hold');
  const run = f.start('build');
  const child = Number(await f.ready('build.ready'));
  t.after(() => { try { process.kill(-child, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } });
  run.child.kill('SIGKILL');
  assert.deepEqual(await run.done, { code: null, signal: 'SIGKILL' });
  assert.equal((await f.start('build').done).code, 75);
  process.kill(-child, 'SIGTERM');
  await waitFor(() => { try { process.kill(child, 0); return false; } catch (error) { if (error.code === 'ESRCH') return true; throw error; } }, 'orphan child exit');
  const directories = await readdir(join(f.root, '.audit', 'runs'));
  const records = await Promise.all(directories.map(async id => {
    try { return JSON.parse(await readFile(join(f.root, '.audit', 'runs', id, 'result.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }));
  assert.equal(records.filter(record => record === null).length, 1);
  assert.equal(records.find(Boolean).outcome.kind, 'busy');
});

test('another cwd and a symlink alias still address the same installed workspace transaction', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  const alias = join(f.root, '.audit', 'alias');
  await symlink(f.root, alias, 'dir');
  await f.flag('hold');
  const first = f.start('build');
  await f.ready('build.ready');
  const cwd = join(f.root, '.audit');
  assert.equal((await f.start('build', false, { alias, cwd }).done).code, 75);
  assert.equal((await f.start('build', true, { alias, cwd }).done).code, 75);
  await f.flag('release');
  assert.equal((await first.done).code, 0);
  const receipts = await f.receipts();
  assert.equal(receipts.length, 3);
  for (const receipt of receipts) assert.equal(receipt.value.workspace, await realpath(f.root));
  for (const receipt of receipts.filter(row => row.value.outcome.kind === 'busy')) assert.equal(receipt.value.invocationCwd, await realpath(cwd));
});

test('dirty file and directory symlinks record their link identity without reading directory contents', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  await symlink('input.txt', join(f.root, 'file-link'));
  await symlink('scripts', join(f.root, 'directory-link'), 'dir');
  assert.equal((await f.start('build').done).code, 0);
  const [row] = await f.receipts();
  assert.equal(row.value.sourceBefore.dirty, true);
  assert.deepEqual(row.value.sourceBefore.symlinks, [{ path: 'directory-link', target: 'scripts' }, { path: 'file-link', target: 'input.txt' }]);
  assert.deepEqual(row.value.sourceBefore, row.value.sourceAfter);
});

test('changing a symlink target during work cannot qualify as unchanged-source success', { timeout: 30000 }, async t => {
  const f = await fixture(t);
  const link = join(f.root, 'source-link');
  await symlink('input.txt', link);
  await f.flag('hold');
  const run = f.start('build');
  await f.ready('build.ready');
  await rm(link);
  await symlink('scripts', link, 'dir');
  await f.flag('release');
  assert.equal((await run.done).code, 1);
  const [row] = await f.receipts();
  assert.notEqual(row.value.sourceBefore.inputDigest, row.value.sourceAfter.inputDigest);
  assert.deepEqual(row.value.sourceBefore.symlinks, [{ path: 'source-link', target: 'input.txt' }]);
  assert.deepEqual(row.value.sourceAfter.symlinks, [{ path: 'source-link', target: 'scripts' }]);
});
