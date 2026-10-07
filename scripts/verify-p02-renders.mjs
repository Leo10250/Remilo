/** Actual saved RN/Compose pair measurements; never rewrites capture inputs. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const mode=process.argv[2];
if(mode==='--help') { console.log('node scripts/verify-p02-renders.mjs --check|--report [sharp-package-path]\nRead-only measurements (--check), or write the P02 sample measurement report (--report). Original captures remain unchanged.'); process.exit(0); }
assert.ok(['--check','--report'].includes(mode) && process.argv.length<=4);
const sharp=createRequire(import.meta.url)(process.argv[3] || 'sharp');
const root=resolve(import.meta.dirname,'..','docs/evidence/redesign-p02/sample-r1');
const luminance=rgb=>rgb.map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
const results=[],targets=[],boundaries=[],pairs=[];
for(const renderer of ['rn','native']) {
 const directory=join(root,renderer);
 const index=JSON.parse(await readFile(join(directory,'index.json')));
 const entries=new Map(index.snapshots.map(e=>[e.file,e]));
 assert.equal(entries.size,index.snapshots.length,'Duplicate captures');
 for(const entry of index.snapshots.filter(e=>!e.backgroundOnly)) {
  const ext=renderer==='rn'?'.jpg':'.png';
  const paired=entries.get(entry.file.replace(ext,'-background'+ext)); assert.ok(paired,'Paired capture exists');
  const original=await sharp(await readFile(join(directory,entry.file))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const background=await sharp(await readFile(join(directory,paired.file))).removeAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual(original.info,background.info);
  const meta=renderer==='rn'?entry.metadata:entry;
  const pixelScale=renderer==='rn'?1/meta.hostNormalization:1;
  assert.ok(Number.isFinite(pixelScale) && pixelScale>0 && pixelScale<=1,'Measured host normalization');
  if(renderer==='native') { assert.equal(original.info.width,meta.width); assert.equal(original.info.height,meta.height); }
  pairs.push({file:entry.file,background:paired.file,pixelScale,originalPreserved:true});
  if(renderer==='rn') {
   assert.ok(meta.textBounds.filter(t=>!t.icon).every(t=>!t.clipped),entry.file+' text glyphs wrap without clipping');
   assert.ok(meta.images.every(a=>a.loaded),entry.file+' requested images loaded');
   assert.ok((meta.fields || []).every(f=>f.scrollHeight<=f.clientHeight+1 && f.scrollWidth<=f.clientWidth+1),entry.file+' field content fits without internal clipping');
   for(const action of meta.controls) {
    assert.ok(action.bounds.width>=47.9 && action.bounds.height>=47.9,entry.file+' minimum target '+action.label);
    targets.push({file:entry.file,label:action.label,width:action.bounds.width,height:action.bounds.height});
   }
   if(entry.scroll==='end' && entry.mode!=='primitives' && !entry.extra?.sheet) {
    const label=entry.mode==='browsing'?'Add reminder':entry.content==='chinese'?'稍后再提醒':'Postpone';
    const action=meta.controls.find(c=>c.label?.includes(label) || entry.mode==='browsing' && c.label?.includes('添加提醒'));
    assert.ok(action && action.bounds.top>=0 && action.bounds.top+action.bounds.height<=meta.height+1,entry.file+' bottom action reachable');
   }
  }
  for(const element of meta.textBounds) {
   const bounds=renderer==='rn'?element.bounds:{left:element.bounds[0],top:element.bounds[1],width:element.bounds[2],height:element.bounds[3]};
   const authored=renderer==='rn'?element.ink:element.ink;
   if(!authored || bounds.width<=0 || bounds.height<=0)continue;
   const ink=renderer==='rn'?authored.match(/[\d.]+/g).slice(0,3).map(Number):[(authored>>>16)&255,(authored>>>8)&255,authored&255];
   const font=renderer==='rn'?element.fontPx:element.fontSp*entry.fontScale;
   const threshold=element.icon || font>=24 || font>=18.667 && Number(element.weight||400)>=700?3:4.5;
   const clip=element.clip || {left:0,top:0,width:meta.width,height:meta.height};
   const origin=meta.frameOrigin || {left:0,top:0};
   const x0=Math.max(0,Math.ceil((Math.max(bounds.left,clip.left)+origin.left)*pixelScale-.5)),y0=Math.max(0,Math.ceil((Math.max(bounds.top,clip.top)+origin.top)*pixelScale-.5));
   const x1=Math.min(original.info.width,Math.ceil((Math.min(bounds.left+bounds.width,clip.left+clip.width)+origin.left)*pixelScale-.5)),y1=Math.min(original.info.height,Math.ceil((Math.min(bounds.top+bounds.height,clip.top+clip.height)+origin.top)*pixelScale-.5));
   let minimum=Infinity,samples=0;
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++) {
    const i=(y*original.info.width+x)*3;
    if(Math.max(...[0,1,2].map(c=>Math.abs(original.data[i+c]-background.data[i+c])))<25)continue;
    minimum=Math.min(minimum,ratio(luminance(ink),luminance([...background.data.subarray(i,i+3)]))); samples++;
   }
   if(samples)results.push({renderer,file:entry.file,text:element.text,minimum,threshold,samples,passed:minimum>=threshold});
  }
  if(renderer==='native' && !entry.primitives)for(const label of ['Stop','Snooze · 10 min','Stop all']) {
   const text=meta.textBounds.find(t=>t.text===label); if(!text)continue;
   const [left,top,width,height]=text.bounds, y=Math.round(top+height/2); if(width<=0||height<=0||y<0||y>=meta.height)continue;
   const rgb=x=>[...background.data.subarray((y*meta.width+x)*3,(y*meta.width+x)*3+3)];
   // Actual adjacent opaque surface: x24 is inside the 16 dp card gutter,
   // immediately outside the x32 single/footer action. Scene x0 is not adjacent.
   const adjacent=luminance(rgb(24));
   const boundary=Math.max(...Array.from({length:Math.max(1,Math.floor(left)-30)},(_,x)=>ratio(luminance(rgb(x+30)),adjacent)));
   if(!entry.file.includes('-busy'))boundaries.push({file:entry.file,label,minimum:boundary,threshold:3,passed:boundary>=3});
  }
 }
}
const failures=results.filter(r=>!r.passed), boundaryFailures=boundaries.filter(r=>!r.passed);
const report={revision:'P02-sample-r1',deviceEvidence:false,method:'Paired unchanged-layout background pixels under glyph differences >=25 RGB levels; authored full foreground ink. Original RN JPEG/native PNG captures preserved. Pixel/CSS ratio measured from actual dimensions. No text nodes removed; numerical bounds canonicalized at 0.001 dp by capture harness.',
 pairs:pairs.length,textElements:results.length,minimumTextContrast:Math.min(...results.map(r=>r.minimum)),minimumTargetDp:Math.min(...targets.flatMap(t=>[t.width,t.height])),nativeBoundaries:boundaries.length,
 failures,boundaryFailures,results,targets,boundaries,pairRecords:pairs};
if(mode==='--report')await writeFile(join(root,'render-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pairs:report.pairs,textElements:report.textElements,minimum:report.minimumTextContrast,minimumTargetDp:report.minimumTargetDp,failures:failures.slice(0,8),totalFailures:failures.length,boundaryFailures:boundaryFailures.slice(0,8),totalBoundaryFailures:boundaryFailures.length},null,2));
assert.equal(failures.length,0,'Composite text contrast'); assert.equal(boundaryFailures.length,0,'Essential native control contrast');
