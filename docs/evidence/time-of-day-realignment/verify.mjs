import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const task=path.dirname(fileURLToPath(import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const findings=[];const checks={};
const baseline=JSON.parse(fs.readFileSync(path.join(task,'immutable-baseline.json')));
for(const f of baseline)if(hash(f.path)!==f.sha256)findings.push({check:'immutable',path:f.path});
checks.preexistingImmutable=baseline.length;
const archive='docs/design/history/pre-r3-realignment';
const snapshot=JSON.parse(read(archive+'/manifest.json'));
for(const f of snapshot.files)if(hash(archive+'/'+f.file)!==f.sha256)findings.push({check:'snapshot',path:f.file});
checks.archivedSnapshots=snapshot.files.length;
const frozen=JSON.parse(read('docs/design/history/preservation-registry.json'));
for(const f of frozen.files)if(hash(f.path)!==f.sha256)findings.push({check:'frozen-submission',path:f.path});
checks.frozenSubmissions=frozen.files.length;
const relocation=JSON.parse(read('docs/design/remilo-r10-data-help/relocation-manifest.json'));
for(const f of relocation.files)if(hash('docs/design/remilo-r10-data-help/'+f.file)!==f.sha256)findings.push({check:'r10-relocation',path:f.file});
checks.relocatedR10Files=relocation.files.length;
const a35=JSON.parse(read('docs/design/approved-ui-r10-outline-acceptance.json'));
for(const f of a35.associatedReferences)if(hash('docs/design/remilo-r10-data-help/'+f.file)!==f.sha256)findings.push({check:'r10-accepted',path:f.file});
checks.acceptedR10Pngs=a35.associatedReferences.length;
const before=read(archive+'/docs/backlog.md').split(/\r?\n/).filter(l=>/^\| [A-Z][\w-]* \|/.test(l));
const after=read('docs/backlog.md').split(/\r?\n/);
for(const row of before)if(!after.includes(row))findings.push({check:'retained-backlog-row',row});
checks.retainedBacklogRows=before.length;
let jsonCount=0;let linkCount=0;const missingLinks=[];
const immutablePaths=new Set(frozen.files.map(f=>f.path));
function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory()){if(!['history','references','artwork','generation'].includes(e.name))walk(p);}else{
 if(e.name.endsWith('.json')){try{JSON.parse(read(p));jsonCount++;}catch(error){findings.push({check:'json',path:p,message:error.message});}}
 if(!e.name.endsWith('.md')||p.startsWith('docs/evidence/')||p.includes('submission-')||p.startsWith('docs/design/remilo-r10-data-help/')||immutablePaths.has(p))continue;
 const text=read(p);for(const m of text.matchAll(/\]\(([^\n)]+)\)/g)){let target=m[1];if(/^(https?:|mailto:|#|codex:|[A-Za-z]:)/.test(target))continue;target=target.split('#')[0];if(!target)continue;linkCount++;const resolved=path.resolve(root,path.dirname(p),decodeURIComponent(target));if(!fs.existsSync(resolved))missingLinks.push({path:p,target:m[1]});}
}}}
walk('docs');
checks.jsonFilesParsed=jsonCount;checks.currentLocalLinks=linkCount;findings.push(...missingLinks.map(x=>({check:'local-link',...x})));
const gallery='docs/design/remilo-r10-data-help';let resources=0;
for(const file of ['gallery.html','gallery.css','gallery.js']){const text=read(gallery+'/'+file);const re=file.endsWith('.html')?/(?:src|href)="([^"#]+)"/g:/url\(["']?([^\)'"#]+)["']?\)/g;for(const m of text.matchAll(re)){if(/^(https?:|data:|#)/.test(m[1]))continue;const p=path.posix.join(gallery,m[1]);resources++;if(!fs.existsSync(path.join(root,p)))findings.push({check:'r10-resource',path:file,target:m[1]});}}
const captures=JSON.parse(read(gallery+'/capture-index.json'));
for(const row of captures){for(const key of ['file','image','imagePath','path'])if(typeof row[key]==='string'&&row[key].endsWith('.png')){resources++;if(!fs.existsSync(path.join(root,gallery,row[key])))findings.push({check:'r10-capture',id:row.id,target:row[key]});}}
checks.r10LocalResources=resources;
const tracked=cp.execFileSync('git',['diff','--name-only','HEAD'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const bad=tracked.filter(p=>!p.startsWith('docs/')&&!p.endsWith('README.md')&&p!=='AGENTS.md'&&p!=='.gitattributes');
for(const p of bad)findings.push({check:'non-doc-diff',path:p});checks.trackedChangedFiles=tracked.length;
const result={date:'2026-10-08',checks,findings};
console.log(JSON.stringify(result,null,2));if(findings.length)process.exitCode=1;
