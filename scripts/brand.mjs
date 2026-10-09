// Copy hash-bound, individually approved Classic exports. Never redraw the mark.
import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const required = ['classic-legacy-launcher','classic-adaptive','classic-monochrome','classic-splash','classic-notification','classic-favicon'];
const densityNames = ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const currentCentering = entry => entry?.centeringRevision===2 && Array.isArray(entry.sourceAnchorPx) &&
  entry.sourceAnchorPx.length===2 && entry.sourceAnchorPx[0]===233 && entry.sourceAnchorPx[1]===243;
export function classicPlan(registry) {
  const entries = new Map(registry.exports.map(entry => [entry.id,entry]));
  const missing = required.filter(id => !entries.get(id)?.approval?.path);
  if (missing.length) throw new Error('Individual artwork-and-activation approvals required: '+missing.join(', '));
  // The owner rejected the prior centering. Preserve its historical records,
  // but never activate a mixed set or an earlier centered revision.
  for(const id of required) if(!currentCentering(entries.get(id))) throw new Error('Current Classic centering revision 2 required: '+id);
  const files = [];
  const add = (id,roles,width,destination,density) => {
    const matches = entries.get(id).productionFiles?.filter(file => roles.includes(file.role) && file.width===width && file.height===width && (!density || file.density===density)) ?? [];
    if(matches.length!==1) throw new Error(id+': expected one '+roles.join('/')+' '+width+'px export'+(density?' '+density:''));
    files.push({assetId:id,source:matches[0].path,sha256:matches[0].sha256,destination,approval:entries.get(id).approval.path,
      centeringRevision:entries.get(id).centeringRevision,sourceAnchorPx:[...entries.get(id).sourceAnchorPx]});
  };
  add(required[0],['configuration'],1024,'assets/images/icon.png');
  add(required[1],['foreground'],432,'assets/images/android-icon-foreground.png');
  add(required[1],['background'],432,'assets/images/android-icon-background.png');
  add(required[2],['monochrome','configuration'],432,'assets/images/android-icon-monochrome.png');
  add(required[3],['configuration'],288,'assets/images/splash-icon.png');
  add(required[4],['notification','vector'],24,'modules/remilo-alarm/android/src/main/res/drawable/ic_remilo_notification.xml');
  add(required[5],['favicon'],48,'assets/images/favicon.png');
  densityNames.forEach((density,index)=> {
    add(required[0],['legacy'],[48,72,96,144,192][index],'android/app/src/main/res/mipmap-'+density+'/ic_launcher.webp',density);
    add(required[0],['legacy-round'],[48,72,96,144,192][index],'android/app/src/main/res/mipmap-'+density+'/ic_launcher_round.webp',density);
    const layerSize=[108,162,216,324,432][index];
    add(required[1],['foreground'],layerSize,'android/app/src/main/res/mipmap-'+density+'/ic_launcher_foreground.png');
    add(required[1],['background'],layerSize,'android/app/src/main/res/mipmap-'+density+'/ic_launcher_background.png');
    add(required[2],['monochrome','configuration'],layerSize,'android/app/src/main/res/mipmap-'+density+'/ic_launcher_monochrome.png');
    add(required[3],['native-'+[76,114,152,228,304][index]], [76,114,152,228,304][index],'android/app/src/main/res/drawable-'+density+'/splashscreen_logo.png');
  });
  for(const file of files) {
    if(!file.source?.startsWith('assets/brand/classic/') || file.source.includes('\\') || file.source.split('/').some(part=>part==='..'||part==='')) throw new Error('Classic source must remain under assets/brand/classic');
    if(extname(file.source).toLowerCase()!==extname(file.destination)) throw new Error('Copier requires the approved source format: '+file.destination);
  }
  return files;
}
export async function validateClassicSources(workspace,files,{sources=[]}={}) {
  // Validate the entire transaction before touching any active resource.
  for(const source of sources) {
    if(!source?.path || !source.sha256 || sha(await readFile(join(workspace,source.path)))!==source.sha256) throw new Error('Stale Classic reference source: '+source?.path);
  }
  for(const file of files) {
    const bytes=await readFile(join(workspace,file.source));
    const approval=JSON.parse(await readFile(join(workspace,file.approval),'utf8'));
    if(sha(bytes)!==file.sha256 || !approval.files?.some(entry=>entry.path===file.source && entry.sha256===file.sha256)) throw new Error('Stale/unapproved Classic bytes: '+file.source);
    if(approval.assetId!==file.assetId || typeof approval.ownerStatement!=='string' || !approval.ownerStatement.trim() ||
      typeof approval.recordedAtUtc!=='string' || !approval.recordedAtUtc || approval.activationApproved!==true) throw new Error('Invalid Classic activation approval: '+file.assetId);
    if(!currentCentering(file) || !currentCentering(approval)) throw new Error('Unbound Classic centering approval: '+file.assetId);
    for(const source of sources) if(!approval.sources?.some(entry=>entry.path===source.path && entry.sha256===source.sha256)) throw new Error('Unbound Classic reference source: '+file.assetId);
  }
}
export async function copyClassic(workspace,registry,{check=false}={}) {
  const files=classicPlan(registry);await validateClassicSources(workspace,files,{sources:[registry.source,registry.sourceBoard]});
  for(const file of files) {
    const target=join(workspace,file.destination);
    if(check) {
      if(sha(await readFile(target))!==file.sha256) throw new Error('Classic copy differs: '+file.destination);
      if(/mipmap-.*\/ic_launcher_(foreground|background|monochrome)\.png$/.test(file.destination)) {
        let collision=false;
        try {await access(target.replace(/\.png$/,'.webp'));collision=true;} catch(error) {if(error.code!=='ENOENT')throw error;}
        if(collision)throw new Error('Retired Classic WebP layer collides: '+file.destination);
      }
    }
    else {
      await mkdir(dirname(target),{recursive:true});await copyFile(join(workspace,file.source),target);
      // Retired WebP layers would collide with the same PNG resource name.
      if(/mipmap-.*\/ic_launcher_(foreground|background|monochrome)\.png$/.test(file.destination)) await rm(target.replace(/\.png$/,'.webp'),{force:true});
    }
  }
  const xml='<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@mipmap/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/><monochrome android:drawable="@mipmap/ic_launcher_monochrome"/></adaptive-icon>\n';
  for(const name of ['ic_launcher','ic_launcher_round']) {
    const path=join(workspace,'android/app/src/main/res/mipmap-anydpi-v26/'+name+'.xml');
    if(check) { if(await readFile(path,'utf8')!==xml) throw new Error('Classic adaptive selector differs: '+name); }
    else {await mkdir(dirname(path),{recursive:true});await writeFile(path,xml);}
  }
  return files;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const flags=process.argv.slice(2);
  if(flags.includes('--help')) console.log('node scripts/brand.mjs [--check]\nRequires all six individually artwork-and-activation approved Classic exports with centering revision 2 and source anchor [233,243]. Copies exact bytes to tracked resources; --check is read-only. No Prebuild/install.');
  else try {
    if(flags.some(flag=>flag!=='--check')) throw new Error('Unknown option; use --help');
    const workspace=fileURLToPath(new URL('../',import.meta.url));
    const registry=JSON.parse(await readFile(join(workspace,'docs/design/production-assets/brand-manifest.json'),'utf8'));
    const files=await copyClassic(workspace,registry,{check:flags.includes('--check')});
    console.log('Validated '+files.length+' approved Classic copies'+(flags.includes('--check')?'':' and updated native selectors')+'.');
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
