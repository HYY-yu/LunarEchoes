import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const page = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>进度存储独立验收 / Progress storage audit</title><style>body{max-width:900px;margin:24px auto;padding:16px;background:#10151b;color:#dce9e7;font:16px monospace}button,select{padding:12px;font:inherit}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>存储边界隔离验收</h1><p>Test fixture only. No game entry, real victory or campaign UI. Manual controls change this dedicated test origin. Run checks restores the key it finds before the suite.</p><button id="run">运行实际 localStorage 检查 / Run checks</button><hr><button id="inspect">Inspect raw key</button><button id="open">Open new session</button><select id="stage" aria-label="Synthetic advanced boundary"></select><button id="advance">Synthetic advanced</button><button id="invalid">Put invalid fixture</button><button id="unknown">Put unknown version fixture</button><button id="cancel">Cancel reset</button><button id="confirm">Confirm reset</button><button id="clear">Clear test key</button><pre id="manual"></pre><pre id="result">Ready</pre><script type="module">
import {openProgressStorage,PROGRESS_STORAGE_KEY} from './progress-storage.js';
import {encodeProgress} from './progress.js';
import {STAGE_ORDER} from './stage-contract.js';
const output=document.querySelector('#result');
const button=document.querySelector('#run');
const operations=[];
const manual=document.querySelector('#manual');
const controlledPort={getItem:key=>{operations.push('get');return localStorage.getItem(key);},setItem:(key,value)=>{operations.push('set');localStorage.setItem(key,value);}};
let active=openProgressStorage(controlledPort);
function show(){manual.textContent=JSON.stringify({fixture:true,key:PROGRESS_STORAGE_KEY,raw:localStorage.getItem(PROGRESS_STORAGE_KEY),snapshot:active.snapshot(),operations},null,2);}
const picker=document.querySelector('#stage');
for(const id of STAGE_ORDER){const option=document.createElement('option');option.value=id;option.textContent=id;picker.append(option);}
picker.value='rainforest';
document.querySelector('#inspect').addEventListener('click',show);
document.querySelector('#open').addEventListener('click',()=>{active=openProgressStorage(controlledPort);show();});
document.querySelector('#advance').addEventListener('click',()=>{active.saveAdvanced({kind:'advanced',progress:{version:1,highestUnlockedStageId:picker.value}});show();});
document.querySelector('#invalid').addEventListener('click',()=>{localStorage.setItem(PROGRESS_STORAGE_KEY,' malformed fixture 原文\\n');show();});
document.querySelector('#unknown').addEventListener('click',()=>{localStorage.setItem(PROGRESS_STORAGE_KEY,'{"version":9}');show();});
document.querySelector('#cancel').addEventListener('click',()=>{active.reset('cancelled');show();});
document.querySelector('#confirm').addEventListener('click',()=>{active.reset('confirmed');show();});
document.querySelector('#clear').addEventListener('click',()=>{localStorage.removeItem(PROGRESS_STORAGE_KEY);active=openProgressStorage(controlledPort);show();});
show();
button.addEventListener('click',()=>{
  button.disabled=true;
  const original=localStorage.getItem(PROGRESS_STORAGE_KEY);
  const observations=[];
  const record=(name,condition,details)=>{
    observations.push({name,passed:Boolean(condition),details});
    if(!condition)throw new Error('Storage audit failed: '+name);
  };
  const advance=id=>({kind:'advanced',progress:{version:1,highestUnlockedStageId:id}});
  const canonical=id=>encodeProgress({version:1,highestUnlockedStageId:id});
  const port={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)};
  try{
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
    let session=openProgressStorage(port);
    record('absent key is not created',localStorage.getItem(PROGRESS_STORAGE_KEY)===null,session.snapshot());
    const saved=session.saveAdvanced(advance('rainforest'));
    record('advanced writes and confirms',saved.result.kind==='saved'&&localStorage.getItem(PROGRESS_STORAGE_KEY)===canonical('rainforest'),saved);
    session=openProgressStorage(port);
    record('new session restores valid boundary',session.snapshot().progress.highestUnlockedStageId==='rainforest',session.snapshot());
    localStorage.setItem(PROGRESS_STORAGE_KEY,canonical('watchtower'));
    const merged=session.saveAdvanced(advance('antarctica'));
    record('newer stored boundary survives',merged.progress.highestUnlockedStageId==='watchtower'&&localStorage.getItem(PROGRESS_STORAGE_KEY)===canonical('watchtower'),merged);
    for(const raw of [' malformed fixture 原文\\n','{"version":9}']){
      localStorage.setItem(PROGRESS_STORAGE_KEY,raw);
      session=openProgressStorage(port);
      const rejected=session.snapshot();
      record('rejected bytes preserved',rejected.result.kind==='recovery_required'&&localStorage.getItem(PROGRESS_STORAGE_KEY)===raw,{reason:rejected.result.reason});
      session.reset('cancelled');
      const temporary=session.saveAdvanced(advance('rainforest'));
      record('cancel and temporary advancement never overwrite',temporary.progress.highestUnlockedStageId==='rainforest'&&temporary.result.kind==='protected'&&localStorage.getItem(PROGRESS_STORAGE_KEY)===raw,temporary);
      const reset=session.reset('confirmed');
      record('confirmed reset verifies and releases protection',reset.result.kind==='reset'&&reset.protection.kind==='ready'&&reset.progress.highestUnlockedStageId==='desert-base'&&localStorage.getItem(PROGRESS_STORAGE_KEY)===canonical('desert-base'),reset);
    }
    output.textContent=JSON.stringify({event:'progress.storage.browser_audit',passed:true,origin:location.origin,checks:observations},null,2);
  }catch(error){
    console.error({event:'progress.storage.browser_audit_failed',error});
    output.textContent=JSON.stringify({passed:false,error:String(error),checks:observations},null,2);
  }finally{
    if(original===null)localStorage.removeItem(PROGRESS_STORAGE_KEY);else localStorage.setItem(PROGRESS_STORAGE_KEY,original);
    output.textContent+='\\nOriginal test-origin key restored: '+(localStorage.getItem(PROGRESS_STORAGE_KEY)===original);
    button.disabled=false;
  }
});
</script></html>`;

const files = new Map(['/progress-storage.js', '/progress.js', '/stage-contract.js'].map(path => [path, new URL(`../dist${path}`, import.meta.url)]));
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/favicon.ico') { response.writeHead(204).end(); return; }
  try {
    if (path !== '/' && !files.has(path)) { response.writeHead(404).end('Not found'); return; }
    const body = path === '/' ? page : await readFile(files.get(path));
    response.writeHead(200, { 'content-type': path === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }).end(body);
  } catch (error) {
    console.error({ event: 'progress.storage.audition_failed', error });
    response.writeHead(500).end('Fixture unavailable');
  }
});
server.on('error', error => { console.error({ event: 'progress.storage.audition_server_failed', error }); process.exitCode = 1; });
server.listen(Number(process.env.PORT || 4190), '127.0.0.1', () => console.info({ event: 'progress.storage.audition_ready', url: `http://127.0.0.1:${server.address().port}/` }));
