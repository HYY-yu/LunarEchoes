import { execFileSync } from 'node:child_process';
import ts from 'typescript';
export async function loadCoreRevision(revision) {
  if (!/^[0-9a-f]{40}$/i.test(revision ?? '')) throw new Error('Expected a 40-hex core revision');
  const read = name => execFileSync('git', ['show', `${revision}:src/${name}.ts`], { encoding: 'utf8' });
  const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const url = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`;
  const source = read('core');
  const rulesSource = source.includes("'./stage-rules.js'") ? read('stage-rules') : null;
  const standalone = rulesSource === null ? source : source.replace("'./stage-rules.js'", JSON.stringify(url(rulesSource)));
  return { core: await import(url(standalone)), source, rulesSource };
}
