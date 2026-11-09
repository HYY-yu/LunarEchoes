import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile, realpath, rm, rename, readdir, cp, lstat, readlink } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finished } from 'node:stream/promises';

const commands = new Set(['build', 'test', 'check', 'verify', 'dev', 'simulate', 'serve']);
const workspace = fileURLToPath(new URL('..', import.meta.url));
const gitEnvironment = Object.fromEntries(Object.entries(process.env).filter(([name]) => !['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'].includes(name)));

async function identity(root) {
  const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: gitEnvironment });
  const head = git(['rev-parse', 'HEAD']).trim();
  const status = git(['status', '--porcelain', '--untracked-files=all']);
  const paths = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean).sort();
  const digest = createHash('sha256');
  const symlinks = [];
  for (const path of paths) {
    digest.update(path + '\0');
    try {
      const input = join(root, path), type = await lstat(input);
      if (type.isSymbolicLink()) {
        const target = await readlink(input);
        symlinks.push({ path, target });
        digest.update('symlink\0' + target + '\0');
      } else if (type.isFile()) {
        const data = await readFile(input);
        digest.update('file\0' + data.length + '\0').update(data);
      } else throw new Error('Unsupported source input type: ' + path);
    }
    catch (error) { if (error.code !== 'ENOENT') throw error; digest.update('deleted\0'); }
  }
  return { head, dirty: status.length > 0, status, inputDigest: digest.digest('hex'), symlinks };
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function groupAlive(pid) {
  try { process.kill(-pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
function signalGroup(pid, signal) {
  try { process.kill(-pid, signal); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}

export async function runTask(command) {
  if (!commands.has(command)) { console.error({ level: 'error', event: 'task.invalid_command', command }); process.exitCode = 1; return { kind: 'tool-error', code: 1 }; }
  const invocationCwd = process.cwd();
  const root = await realpath(workspace);
  process.chdir(root);
  const runRoot = join(root, '.audit', 'runs');
  await mkdir(runRoot, { recursive: true });
  const directory = await mkdtemp(join(runRoot, 'run-'));
  const runId = basename(directory);
  const lock = join(root, '.audit', 'dist-transaction');
  const stdoutPath = join(directory, 'stdout.log'), stderrPath = join(directory, 'stderr.log');
  const startedAt = new Date().toISOString();
  const children = [];
  const steps = [];
  let held = false, cancellation = null, infrastructureError = null, server = null;
  let sourceBefore = null, sourceAfter = null, outcome = { kind: 'tool-error', code: 1 };
  const outputs = [createWriteStream(stdoutPath, { flags: 'wx' }), createWriteStream(stderrPath, { flags: 'wx' })];
  const outputDone = outputs.map(stream => finished(stream).catch(error => { infrastructureError ??= error; }));
  function cancel(signal) {
    cancellation ??= signal;
    for (const child of children) if (!child.finished) signalGroup(child.pid, signal);
    if (server) { server.close(); server.closeAllConnections(); }
  }
  for (const output of outputs) output.on('error', error => { infrastructureError ??= error; cancel('SIGTERM'); });
  const write = (index, value) => {
    const data = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value) + '\n';
    outputs[index].write(data);
    (index ? process.stderr : process.stdout).write(data);
  };
  const info = value => write(0, value), error = value => write(1, value);
  const int = () => cancel('SIGINT'), term = () => cancel('SIGTERM');
  process.on('SIGINT', int);
  process.on('SIGTERM', term);
  const checkCancelled = () => { if (cancellation) throw { kind: 'signalled', code: null, signal: cancellation }; if (infrastructureError) throw infrastructureError; };
  async function ownerState() {
    const temporary = join(lock, runId + '.json');
    await writeFile(temporary, JSON.stringify({ runId, pid: process.pid, workspace: root, directory, children }), { flag: 'wx' });
    await rename(temporary, join(lock, 'owner.json'));
  }
  async function release() {
    if (!held) return;
    const owner = JSON.parse(await readFile(join(lock, 'owner.json'), 'utf8'));
    if (owner.runId !== runId || owner.pid !== process.pid) throw new Error('Workspace transaction ownership changed');
    await rm(lock, { recursive: true });
    held = false;
  }
  async function stopChildren() {
    const active = children.filter(child => !child.reaped);
    for (const child of active) {
      if (groupAlive(child.pid)) signalGroup(child.pid, cancellation || 'SIGTERM');
    }
    const deadline = Date.now() + 2000;
    while (active.some(child => groupAlive(child.pid)) && Date.now() < deadline) await delay(20);
    for (const child of active) if (groupAlive(child.pid)) signalGroup(child.pid, 'SIGKILL');
    const finalDeadline = Date.now() + 2000;
    while (active.some(child => groupAlive(child.pid)) && Date.now() < finalDeadline) await delay(20);
    if (active.some(child => groupAlive(child.pid))) throw new Error('Task descendants are still alive; transaction retained');
  }
  const context = {
    info, error,
    fail(code) { throw { kind: 'finished', code, signal: null }; },
    setServer(value) { server = value; if (cancellation) { server.close(); server.closeAllConnections(); } },
    async execute(name, args) {
      checkCancelled();
      const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'NODE_TEST_CONTEXT'));
      const child = spawn(process.execPath, args, { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const record = { name, command: [process.execPath, ...args], pid: child.pid ?? null, startedAt: new Date().toISOString(), finished: false };
      const closed = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => resolve({ code, signal }));
      });
      child.stdout.on('data', data => write(0, data));
      child.stderr.on('data', data => write(1, data));
      if (!child.pid) { await closed; throw new Error('Task child did not start'); }
      children.push(record);
      await ownerState();
      info({ level: 'debug', event: 'task.child_started', runId, name, pid: child.pid });
      if (cancellation) signalGroup(child.pid, cancellation);
      const result = await closed;
      Object.assign(record, result, { finished: true, endedAt: new Date().toISOString() });
      await ownerState();
      checkCancelled();
      if (result.signal) throw { kind: 'signalled', code: null, signal: result.signal };
      if (result.code !== 0) throw { kind: 'finished', code: result.code, signal: null };
      if (groupAlive(child.pid)) throw new Error('Task child exited before its descendants');
      record.reaped = true;
    }
  };
  try {
    error({ level: 'info', event: 'task.started', runId, command, directory, result: join(directory, 'result.json') });
    sourceBefore = await identity(root);
    const invocation = [process.execPath, ...process.argv.slice(1)];
    await writeFile(join(directory, 'start.json'), JSON.stringify({ runId, command, invocation, invocationCwd, workspace: root, pid: process.pid, startedAt, sourceBefore, stdoutPath, stderrPath, environment: { node: process.version, platform: process.platform, arch: process.arch } }, null, 2), { flag: 'wx' });
    if (process.platform !== 'darwin' && process.platform !== 'linux') throw new Error('Task process-group cleanup is supported on macOS and Linux only');
    try { await mkdir(lock); held = true; }
    catch (failure) {
      if (failure.code !== 'EEXIST') throw failure;
      let ownerRun = null;
      try { ownerRun = JSON.parse(await readFile(join(lock, 'owner.json'), 'utf8')).runId ?? null; }
      catch (readError) { error({ level: 'warn', event: 'task.owner_unavailable', message: String(readError) }); }
      error({ level: 'warn', event: 'task.workspace_busy', runId, ownerRun });
      throw { kind: 'busy', ownerRun, code: 75 };
    }
    await ownerState();
    checkCancelled();
    const operations = await import('./task-steps.mjs');
    const directCheck = command === 'check' && await realpath(resolve(process.argv[1])) === join(root, 'scripts', 'check.mjs');
    const plans = {
      build: ['build'], test: ['build', 'test'], check: directCheck ? ['check'] : ['build', 'check'],
      verify: ['build', 'test', 'build', 'check', 'simulate', 'tooling'], dev: ['build', 'snapshot'], simulate: ['simulate'], serve: ['snapshot']
    };
    for (const name of plans[command]) {
      checkCancelled();
      const step = { name, startedAt: new Date().toISOString() };
      steps.push(step);
      info({ level: 'debug', event: 'task.step_started', runId, name });
      if (name === 'test') {
        const tests = (await readdir('test')).filter(file => file.endsWith('.test.mjs')).sort().map(file => 'test/' + file);
        await context.execute('test', ['--test', ...tests]);
      } else if (name === 'tooling') await context.execute('tooling', ['--test', 'scripts/tooling.test.mjs']);
      else if (name === 'snapshot') await cp(join(root, 'dist'), join(directory, 'dist'), { recursive: true, force: false, errorOnExist: true });
      else await operations[name](context);
      step.finishedAt = new Date().toISOString();
      step.code = 0;
      await new Promise(resolve => setImmediate(resolve));
    }
    sourceAfter = await identity(root);
    if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter)) throw new Error('Task source identity changed during execution');
    if (command === 'dev' || command === 'serve') { await release(); checkCancelled(); await operations.serve(join(directory, 'dist'), context); }
    checkCancelled();
    outcome = { kind: 'finished', code: 0, signal: null };
  } catch (failure) {
    outcome = failure?.kind ? failure : { kind: 'tool-error', code: 1, message: String(failure) };
    if (outcome.kind === 'tool-error') error({ level: 'error', event: 'task.failed', message: outcome.message });
  } finally {
    try {
      await stopChildren();
      sourceAfter = await identity(root);
      if (outcome.code === 0 && JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter)) outcome = { kind: 'tool-error', code: 1, message: 'Task source identity changed during execution' };
      await release();
    } catch (failure) { outcome = { kind: 'tool-error', code: 1, message: String(failure) }; error({ level: 'error', event: 'task.cleanup_failed', message: String(failure) }); }
    if (cancellation && outcome.kind !== 'tool-error') outcome = { kind: 'signalled', code: null, signal: cancellation };
    if (infrastructureError) outcome = { kind: 'tool-error', code: 1, message: String(infrastructureError) };
    error({ level: outcome.code === 0 ? 'info' : 'warn', event: 'task.finished', runId, outcome });
    for (const output of outputs) output.end();
    await Promise.all(outputDone);
    if (infrastructureError) outcome = { kind: 'tool-error', code: 1, message: String(infrastructureError) };
    try {
      await writeFile(join(directory, 'result.json'), JSON.stringify({ runId, command, invocation: [process.execPath, ...process.argv.slice(1)], invocationCwd, workspace: root, startedAt, endedAt: new Date().toISOString(), sourceBefore, sourceAfter, steps, children, stdoutPath, stderrPath, outcome }, null, 2), { flag: 'wx' });
    } catch (failure) { console.error({ level: 'error', event: 'task.result_failed', directory, message: String(failure) }); outcome = { kind: 'tool-error', code: 1, message: String(failure) }; }
    process.removeListener('SIGINT', int);
    process.removeListener('SIGTERM', term);
  }
  if (outcome.kind === 'signalled') process.kill(process.pid, outcome.signal);
  else process.exitCode = outcome.code;
  return outcome;
}

if (import.meta.main) {
  try { await runTask(process.argv[2]); }
  catch (error) { console.error({ level: 'error', event: 'task.start_failed', message: String(error) }); process.exitCode = 1; }
}
