import test from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyAssets, localPath, vectorMetadata } from '../verify-assets.mjs';
import { classicPlan, copyClassic, selectorPaths } from '../brand.mjs';
const repo=path.resolve(import.meta.dirname,'../..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifests=['assets/atmospheres/manifest.json','assets/brand/classic/manifest.json','assets/exercises/manifest.json'];
const read=(root,file)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const write=(root,file,value)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value));};
function fixture(t) {
 const parent=path.join(repo,'verification/local');fs.mkdirSync(parent,{recursive:true});
 const root=fs.mkdtempSync(path.join(parent,'current-assets-'));
 t.after(()=>{assert.equal(path.dirname(root),parent);fs.rmSync(root,{recursive:true,force:true});});
 const files=new Set([...manifests,'assets/atmospheres/presentation.json','src/ui/components.tsx','src/ui/exercise-illustrations.tsx','scripts/presentation.mjs','src/ui/atmosphere.generated.ts',
  'modules/remilo-alarm/android/src/main/java/com/remilo/alarm/presentation/AtmosphereTokens.kt',
  'modules/remilo-alarm/android/src/main/res/values/widget_preview_colors.xml','modules/remilo-alarm/android/src/main/res/values-night/widget_preview_colors.xml',...selectorPaths]);
 for(const file of manifests)for(const asset of Object.values(read(repo,file).assets))for(const entry of [...Object.values(asset.sources),...Object.values(asset.outputs)])for(const value of [entry.path,...entry.copies??[]])files.add(value);
 for(const file of files){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(repo,file),target);}
 return {root,files};
}
function snapshot(root,files){return Object.fromEntries([...files].map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));}

test('current asset checks pass in a plain directory without Git, historical records or mutation',t=>{
 const {root,files}=fixture(t),before=snapshot(root,files);
 assert.equal(fs.existsSync(path.join(root,'.git')),false);assert.equal(fs.existsSync(path.join(root,'docs')),false);
 const result=verifyAssets(root);assert.deepEqual(result.findings,[]);assert.equal(result.checks.presentationPairs,8);assert.equal(result.checks.generatedPresentationFiles,4);
 assert.deepEqual(snapshot(root,files),before);
});
test('corrupt source, derivative and native copy bytes fail current integrity',t=>{
 const {root}=fixture(t),entry=read(root,manifests[0]).assets['sky-light'];
 for(const file of [entry.sources.master.path,entry.outputs.runtime.path,entry.outputs.runtime.copies[0]]){
  const original=fs.readFileSync(path.join(root,file));write(root,file,Buffer.concat([original,Buffer.from('corrupt')]));
  assert.ok(verifyAssets(root,{generated:false}).findings.length,file);write(root,file,original);
 }
});
test('changing a hash cannot conceal a runtime dimension contract violation',t=>{
 const {root}=fixture(t),manifest=read(root,manifests[0]),output=manifest.assets['sky-light'].outputs.runtime;
 output.width=1439;write(root,manifests[0],manifest);
 assert.ok(verifyAssets(root,{generated:false}).findings.some(f=>/dimensions|runtime format/.test(f.message)));
});
test('current recipes and runtime selections must agree and generated files must be fresh',t=>{
 const {root}=fixture(t),canonical=read(root,'assets/atmospheres/presentation.json');
 canonical.pairs['sky-light'].asset='night-light-v2.webp';write(root,'assets/atmospheres/presentation.json',canonical);
 assert.ok(verifyAssets(root).findings.some(f=>f.check==='presentation'));
 fs.copyFileSync(path.join(repo,'assets/atmospheres/presentation.json'),path.join(root,'assets/atmospheres/presentation.json'));
 fs.appendFileSync(path.join(root,'src/ui/atmosphere.generated.ts'),'\n// stale');
 assert.ok(verifyAssets(root).findings.some(f=>f.check==='presentation'));
});
test('illustration catalog coverage grows with consumers rather than a frozen illustration count',t=>{
 const {root}=fixture(t),manifest=read(root,manifests[2]),asset=structuredClone(manifest.assets.walking);
 const file='assets/exercises/new-illustration-v1.webp';write(root,file,fs.readFileSync(path.join(root,asset.outputs.runtime.path)));asset.outputs.runtime.path=file;
 manifest.assets['new-illustration']=asset;write(root,manifests[2],manifest);
 assert.ok(verifyAssets(root,{generated:false}).findings.some(f=>f.check==='exercise-selection'));
 const catalog=fs.readFileSync(path.join(root,'src/ui/exercise-illustrations.tsx'),'utf8').replace('}];',"}, { id: 'new-illustration-v1', labelKey: 'exercise_walking', descriptionKey: 'exercise_walking_description', source: require('../../assets/exercises/new-illustration-v1.webp') }];");
 write(root,'src/ui/exercise-illustrations.tsx',catalog);assert.deepEqual(verifyAssets(root,{generated:false}).findings,[]);
});
test('schema-1 registries and path escapes fail instead of restoring historical approval behavior',t=>{
 const {root}=fixture(t),manifest=read(root,manifests[0]);manifest.schemaVersion=1;write(root,manifests[0],manifest);
 assert.ok(verifyAssets(root,{generated:false}).findings.some(f=>f.check==='asset-manifest'));
 for(const value of ['../outside.png','assets\\..\\outside.png','C:/outside.png','/outside.png'])assert.throws(()=>localPath(root,value));
});
test('Classic copier validates every current input before changing any active resource',async t=>{
 const {root}=fixture(t),manifest=read(root,manifests[1]),plan=classicPlan(manifest),targets=[...plan.map(f=>f.destination),...selectorPaths],before=snapshot(root,targets);
 assert.equal(plan.length,37);
 const last=plan.at(-1);write(root,last.source,'corrupt last input');await assert.rejects(copyClassic(root,manifest),/hash differs/);
 assert.deepEqual(snapshot(root,targets),before);
});
test('Classic mapping rejects missing, duplicate, wrong-shape and escaping output selections',()=>{
 const manifest=read(repo,manifests[1]);
 const missing=structuredClone(manifest);delete missing.assets['classic-adaptive'];assert.throws(()=>classicPlan(missing));
 const duplicate=structuredClone(manifest);duplicate.assets['classic-adaptive'].outputs.foreground=structuredClone(Object.values(duplicate.assets['classic-adaptive'].outputs)[0]);assert.throws(()=>classicPlan(duplicate),/ambiguous/);
 const shape=structuredClone(manifest);Object.values(shape.assets['classic-adaptive'].outputs)[0].width=109;assert.throws(()=>classicPlan(shape),/wrong-shape/);
 const escape=structuredClone(manifest);Object.values(escape.assets['classic-adaptive'].outputs)[0].path='../outside.png';assert.throws(()=>classicPlan(escape),/portable/);
});
test('Classic check is read-only, detects changed selectors and rejects Android resource collisions',async t=>{
 const {root,files}=fixture(t),manifest=read(root,manifests[1]),before=snapshot(root,files);
 await copyClassic(root,manifest,{check:true});assert.deepEqual(snapshot(root,files),before);
 write(root,selectorPaths[0],'stale selector');await assert.rejects(copyClassic(root,manifest,{check:true}),/copy or selector differs/);
 assert.equal(fs.readFileSync(path.join(root,selectorPaths[0]),'utf8'),'stale selector');
 const layer='android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.webp';write(root,layer,'collision');await assert.rejects(copyClassic(root,manifest,{check:true}),/Duplicate Android resource/);
});
test('notification vectors require white paths, a 24dp viewport and no entities',()=>{
 const good='<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFF" android:pathData="M 1 1 L 2 2 Z"/></vector>';
 assert.equal(vectorMetadata(Buffer.from(good)).whiteSilhouette,true);
 for(const bad of [good.replace('#FFFFFF','#FF0000'),good.replace('24dp','25dp'),'<!DOCTYPE vector>'+good,good.replace('M 1 1 L 2 2 Z','invalid')])assert.throws(()=>vectorMetadata(Buffer.from(bad)));
});

test('Classic source changed during staging fails before any active resource mutation',async t=>{
 const {root}=fixture(t),manifest=read(root,manifests[1]),plan=classicPlan(manifest),targets=[...plan.map(f=>f.destination),...selectorPaths],before=snapshot(root,targets);
 const source=path.join(root,plan.at(-1).source),originalRead=fsp.readFile;let changed=false;
 fsp.readFile=async(...args)=>{const bytes=await originalRead(...args);if(String(args[0])===source&&!changed){changed=true;fs.writeFileSync(source,'concurrent source change');}return bytes;};syncBuiltinESMExports();
 try {await assert.rejects(copyClassic(root,manifest),/changed during staging/);}finally{fsp.readFile=originalRead;syncBuiltinESMExports();}
 assert.equal(changed,true);assert.deepEqual(snapshot(root,targets),before);
});
test('Classic manifest changed during staging fails before any active resource mutation',async t=>{
 const {root}=fixture(t),manifest=read(root,manifests[1]),plan=classicPlan(manifest),targets=[...plan.map(f=>f.destination),...selectorPaths],before=snapshot(root,targets);
 const source=path.join(root,plan.at(-1).source),originalRead=fsp.readFile;let changed=false;
 fsp.readFile=async(...args)=>{const bytes=await originalRead(...args);if(String(args[0])===source&&!changed){changed=true;fs.appendFileSync(path.join(root,manifests[1]),' ');}return bytes;};syncBuiltinESMExports();
 try {await assert.rejects(copyClassic(root,manifest),/manifest changed during staging/);}finally{fsp.readFile=originalRead;syncBuiltinESMExports();}
 assert.deepEqual(snapshot(root,targets),before);
});
test('Classic selector publication is atomic and preserves unknown temporary collisions',async t=>{
 const {root}=fixture(t),manifest=read(root,manifests[1]),target=path.join(root,selectorPaths[0]),temporary=target+'.'+process.pid+'.asset-tmp';
 fs.writeFileSync(target,'old selector');fs.writeFileSync(temporary,'another writer');
 await assert.rejects(copyClassic(root,manifest),/EEXIST/);
 assert.equal(fs.readFileSync(target,'utf8'),'old selector');assert.equal(fs.readFileSync(temporary,'utf8'),'another writer');
});
