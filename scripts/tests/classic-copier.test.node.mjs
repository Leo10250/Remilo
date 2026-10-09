import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, writeFile, mkdir, readFile, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { classicPlan, copyClassic, validateClassicSources } from '../brand.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function workspace(t) {
  const root=await mkdtemp(join(tmpdir(),'remilo-classic-'));
  t.after(async()=>{
    const target=resolve(root);
    assert.ok(target.startsWith(resolve(tmpdir())+sep) && basename(target).startsWith('remilo-classic-'));
    await rm(target,{recursive:true,force:true});
  });
  return root;
}
async function write(root,path,bytes) {await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),bytes);}
async function record(root,path) {return JSON.parse(await readFile(join(root,path),'utf8'));}
async function fullFixture(t) {
  const root=await workspace(t), source={path:'assets/brand/reference/icon-classic.png',sha256:sha(Buffer.from('fixture source'))},
    sourceBoard={path:'assets/brand/reference/source-icon-board.png',sha256:sha(Buffer.from('fixture board'))};
  await write(root,source.path,'fixture source');await write(root,sourceBoard.path,'fixture board');
  const ids=['classic-legacy-launcher','classic-adaptive','classic-monochrome','classic-splash','classic-notification','classic-favicon'];
  const registry={schemaVersion:1,source,sourceBoard,exports:ids.map(id=>({id,activeVersion:2,centeringRevision:2,sourceAnchorPx:[233,243],
    approval:{path:'docs/design/production-assets/approvals/'+id+'-v2.json'},productionFiles:[]}))};
  const add=async(id,role,width,extension,density)=>{
    const path='assets/brand/classic/'+id+'/'+role+'-'+width+'.'+extension;
    const bytes=Buffer.from('synthetic '+id+' '+role+' '+width+' '+extension);
    const file={role,path,width,height:width,sha256:sha(bytes),...(density?{density}:{})};
    registry.exports.find(entry=>entry.id===id).productionFiles.push(file);await write(root,path,bytes);
  };
  await add(ids[0],'configuration',1024,'png');
  for(const [index,density] of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'].entries()) {
    await add(ids[0],'legacy',[48,72,96,144,192][index],'webp',density);
    await add(ids[0],'legacy-round',[48,72,96,144,192][index],'webp',density);
    await add(ids[1],'foreground',[108,162,216,324,432][index],'png');
    await add(ids[1],'background',[108,162,216,324,432][index],'png');
    await add(ids[2],'monochrome',[108,162,216,324,432][index],'png');
    await add(ids[3],'native-'+[76,114,152,228,304][index],[76,114,152,228,304][index],'png');
  }
  await add(ids[3],'configuration',288,'png');await add(ids[4],'vector',24,'xml');await add(ids[5],'favicon',48,'png');
  for(const entry of registry.exports) await write(root,entry.approval.path,JSON.stringify({assetId:entry.id,
    version:2,centeringRevision:2,sourceAnchorPx:[233,243],ownerStatement:'Synthetic fixture approval.',recordedAtUtc:'2026-10-09T00:00:00Z',
    sources:[source,sourceBoard],files:entry.productionFiles,activationApproved:true}));
  return {root,registry};
}
async function oldTargets(root,registry) {
  const paths=classicPlan(registry).map(file=>file.destination);
  paths.push(...['ic_launcher','ic_launcher_round'].map(name=>'android/app/src/main/res/mipmap-anydpi-v26/'+name+'.xml'));
  for(const path of paths) await write(root,path,'old '+path);
  return Object.fromEntries(await Promise.all(paths.map(async path=>[path,sha(await readFile(join(root,path)))])));
}
async function unchanged(root,before) {
  for(const [path,hash] of Object.entries(before)) assert.equal(sha(await readFile(join(root,path))),hash,path);
}
test('incomplete artwork approvals reject before planning any native mutation',()=>{
  assert.throws(()=>classicPlan({exports:[{id:'classic-legacy-launcher',approval:{path:'approved.json'}}]}),/classic-adaptive/);
});
test('changed bytes reject despite a recorded source hash and approval',async(t)=>{
  const root=await workspace(t);await mkdir(join(root,'assets'),{recursive:true});
  await writeFile(join(root,'assets/source.png'),'changed');await writeFile(join(root,'approval.json'),JSON.stringify({assetId:'classic-adaptive',ownerStatement:'Approved',recordedAtUtc:'2026-10-09',files:[{path:'assets/source.png',sha256:'expected'}]}));
  await assert.rejects(validateClassicSources(root,[{assetId:'classic-adaptive',source:'assets/source.png',sha256:'expected',approval:'approval.json'}]),/Stale\/unapproved/);
  assert.equal(await readFile(join(root,'assets/source.png'),'utf8'),'changed');
});

test('complete synthetic Classic mapping copies exact bytes, updates selectors and removes old layer collisions',async(t)=>{
  const {root,registry}=await fullFixture(t), plan=classicPlan(registry);
  assert.equal(plan.length,37);
  const maps=(destination,source)=>assert.equal(plan.find(file=>file.destination===destination)?.source,source,destination);
  maps('assets/images/icon.png','assets/brand/classic/classic-legacy-launcher/configuration-1024.png');
  maps('assets/images/android-icon-foreground.png','assets/brand/classic/classic-adaptive/foreground-432.png');
  maps('assets/images/android-icon-background.png','assets/brand/classic/classic-adaptive/background-432.png');
  maps('assets/images/android-icon-monochrome.png','assets/brand/classic/classic-monochrome/monochrome-432.png');
  maps('assets/images/splash-icon.png','assets/brand/classic/classic-splash/configuration-288.png');
  maps('assets/images/favicon.png','assets/brand/classic/classic-favicon/favicon-48.png');
  maps('modules/remilo-alarm/android/src/main/res/drawable/ic_remilo_notification.xml','assets/brand/classic/classic-notification/vector-24.xml');
  for(const [density,legacy,layer,splash] of [['mdpi',48,108,76],['hdpi',72,162,114],['xhdpi',96,216,152],['xxhdpi',144,324,228],['xxxhdpi',192,432,304]]) {
    maps('android/app/src/main/res/mipmap-'+density+'/ic_launcher.webp','assets/brand/classic/classic-legacy-launcher/legacy-'+legacy+'.webp');
    maps('android/app/src/main/res/mipmap-'+density+'/ic_launcher_round.webp','assets/brand/classic/classic-legacy-launcher/legacy-round-'+legacy+'.webp');
    for(const name of ['foreground','background']) maps('android/app/src/main/res/mipmap-'+density+'/ic_launcher_'+name+'.png','assets/brand/classic/classic-adaptive/'+name+'-'+layer+'.png');
    maps('android/app/src/main/res/mipmap-'+density+'/ic_launcher_monochrome.png','assets/brand/classic/classic-monochrome/monochrome-'+layer+'.png');
    maps('android/app/src/main/res/drawable-'+density+'/splashscreen_logo.png','assets/brand/classic/classic-splash/native-'+splash+'-'+splash+'.png');
  }
  for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']) {
    for(const layer of ['foreground','background','monochrome']) await write(root,'android/app/src/main/res/mipmap-'+density+'/ic_launcher_'+layer+'.webp','retired');
  }
  await copyClassic(root,registry);
  for(const file of plan) assert.deepEqual(await readFile(join(root,file.destination)),await readFile(join(root,file.source)),file.destination);
  for(const density of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']) {
    for(const layer of ['foreground','background','monochrome']) await assert.rejects(access(join(root,'android/app/src/main/res/mipmap-'+density+'/ic_launcher_'+layer+'.webp')), {code:'ENOENT'});
  }
  for(const name of ['ic_launcher','ic_launcher_round']) {
    const xml=await readFile(join(root,'android/app/src/main/res/mipmap-anydpi-v26/'+name+'.xml'),'utf8');
    for(const layer of ['foreground','background','monochrome']) assert.ok(xml.includes('<'+layer+' android:drawable="@mipmap/ic_launcher_'+layer+'"/>'));
  }
  const target=join(root,'assets/images/icon.png'), fixed=new Date('2026-01-01T00:00:00Z');
  await utimes(target,fixed,fixed);await copyClassic(root,registry,{check:true});
  assert.equal((await stat(target)).mtimeMs,fixed.getTime(),'--check must leave active resource timestamps unchanged');
});

test('last invalid staged source or approval binding rejects before any active resource changes',async(t)=>{
  const {root,registry}=await fullFixture(t), before=await oldTargets(root,registry), last=classicPlan(registry).at(-1);
  const bytes=await readFile(join(root,last.source));await write(root,last.source,'changed');
  await assert.rejects(copyClassic(root,registry),/Stale\/unapproved/);await unchanged(root,before);
  await write(root,last.source,bytes);
  const approval=await record(root,last.approval);approval.files=approval.files.filter(file=>file.path!==last.source);
  await write(root,last.approval,JSON.stringify(approval));
  await assert.rejects(copyClassic(root,registry),/Stale\/unapproved/);await unchanged(root,before);
});

test('all revised export approvals, including legacy, must explicitly authorize activation',async(t)=>{
  const {root,registry}=await fullFixture(t), before=await oldTargets(root,registry);
  for(const entry of registry.exports) {
    const original=await record(root,entry.approval.path);
    for(const value of [undefined,false,'true',null]) {
      const approval={...original};if(value===undefined)delete approval.activationApproved;else approval.activationApproved=value;
      await write(root,entry.approval.path,JSON.stringify(approval));
      await assert.rejects(copyClassic(root,registry),/Invalid Classic activation approval/);await unchanged(root,before);
    }
    await write(root,entry.approval.path,JSON.stringify(original));
  }
  await copyClassic(root,registry);
});

test('any mixed or earlier centering entry rejects before writing resources and preserves historical approvals',async(t)=>{
  const {root,registry}=await fullFixture(t), before=await oldTargets(root,registry);
  const historical='docs/design/production-assets/approvals/classic-legacy-launcher-v1.json';
  await write(root,historical,'historical approval bytes');
  for(let index=0;index<registry.exports.length;index++) {
    const mixed=structuredClone(registry);mixed.exports[index].centeringRevision=1;
    await assert.rejects(copyClassic(root,mixed),/Current Classic centering revision 2 required/);await unchanged(root,before);
  }
  for(const patch of [{centeringRevision:undefined},{centeringRevision:'2'},{sourceAnchorPx:[233,242]},
    {sourceAnchorPx:[233,243,0]},{sourceAnchorPx:['233',243]}]) {
    const mixed=structuredClone(registry);Object.assign(mixed.exports[0],patch);
    await assert.rejects(copyClassic(root,mixed),/Current Classic centering revision 2 required/);await unchanged(root,before);
  }
  assert.equal(await readFile(join(root,historical),'utf8'),'historical approval bytes');
});

test('revision and source anchor must bind the individual approval before any active copy',async(t)=>{
  const {root,registry}=await fullFixture(t), before=await oldTargets(root,registry), entry=registry.exports.at(-1);
  const original=await record(root,entry.approval.path);
  for(const patch of [{centeringRevision:undefined},{centeringRevision:1},{sourceAnchorPx:undefined},
    {sourceAnchorPx:[233,242]},{sourceAnchorPx:[233,243,0]}]) {
    await write(root,entry.approval.path,JSON.stringify({...original,...patch}));
    await assert.rejects(copyClassic(root,registry),/Unbound Classic centering approval/);await unchanged(root,before);
  }
  await write(root,entry.approval.path,JSON.stringify(original));await copyClassic(root,registry);
});

test('reference source hashes and approval provenance remain bound before activation',async(t)=>{
  const {root,registry}=await fullFixture(t), before=await oldTargets(root,registry), reference=registry.source;
  const bytes=await readFile(join(root,reference.path));await write(root,reference.path,'changed reference');
  await assert.rejects(copyClassic(root,registry),/Stale Classic reference source/);await unchanged(root,before);
  await write(root,reference.path,bytes);
  const path=registry.exports[0].approval.path, approval=await record(root,path);approval.sources=[];await write(root,path,JSON.stringify(approval));
  await assert.rejects(copyClassic(root,registry),/Unbound Classic reference source/);await unchanged(root,before);
});

test('check rejects a colliding WebP layer even when all new PNG bytes and selectors match',async(t)=>{
  const {root,registry}=await fullFixture(t);await copyClassic(root,registry);
  const collision='android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.webp';await write(root,collision,'stale');
  await assert.rejects(copyClassic(root,registry,{check:true}),/Retired Classic WebP layer collides/);
  assert.equal(await readFile(join(root,collision),'utf8'),'stale','read-only check does not repair the collision');
});

test('check detects changed active bytes or selectors without repairing them',async(t)=>{
  const {root,registry}=await fullFixture(t);await copyClassic(root,registry);
  const icon='assets/images/icon.png', bytes=await readFile(join(root,icon));await write(root,icon,'changed active icon');
  await assert.rejects(copyClassic(root,registry,{check:true}),/Classic copy differs/);
  assert.equal(await readFile(join(root,icon),'utf8'),'changed active icon');await write(root,icon,bytes);
  const selector='android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml';await write(root,selector,'changed selector');
  await assert.rejects(copyClassic(root,registry,{check:true}),/Classic adaptive selector differs/);
  assert.equal(await readFile(join(root,selector),'utf8'),'changed selector');
});

test('planning rejects ambiguous, wrong-shape, wrong-format and Windows traversal exports',async(t)=>{
  const {registry}=await fullFixture(t);
  const ambiguous=structuredClone(registry);ambiguous.exports[1].productionFiles.push({...ambiguous.exports[1].productionFiles[0]});
  assert.throws(()=>classicPlan(ambiguous),/expected one foreground/);
  const rectangular=structuredClone(registry);rectangular.exports[1].productionFiles[0].height=109;
  assert.throws(()=>classicPlan(rectangular),/expected one foreground/);
  const format=structuredClone(registry);format.exports[1].productionFiles[0].path=format.exports[1].productionFiles[0].path.replace('.png','.webp');
  assert.throws(()=>classicPlan(format),/approved source format/);
  const traversal=structuredClone(registry);traversal.exports[1].productionFiles[0].path='assets/brand/classic/\\..\\outside.png';
  assert.throws(()=>classicPlan(traversal),/must remain under/);
});
