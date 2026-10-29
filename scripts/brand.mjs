// Copy current Classic exports without redrawing or re-encoding them.
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { access, mkdir, open, readFile, realpath, rename, rm } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const required = ['classic-legacy-launcher','classic-adaptive','classic-monochrome','classic-splash','classic-notification','classic-favicon'];
const densities = ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const adaptiveSelector = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@mipmap/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/><monochrome android:drawable="@mipmap/ic_launcher_monochrome"/></adaptive-icon>\n';
export const selectorPaths = ['ic_launcher','ic_launcher_round'].map(name=>'android/app/src/main/res/mipmap-anydpi-v26/'+name+'.xml');

function portable(value) {
  if(typeof value!=='string'||!value||isAbsolute(value)||value.includes('\\')||value.split('/').some(p=>!p||p==='..'||p==='.')||/^[a-z]+:/i.test(value)) throw new Error('Expected a portable project-relative asset path.');
  return value;
}
export async function boundedPath(workspace,value) {
  portable(value);const root=await realpath(workspace),destination=resolve(workspace,value);
  let ancestor=destination;
  for(;;) {try {ancestor=await realpath(ancestor);break;} catch(error) {if(error.code!=='ENOENT')throw error;const parent=dirname(ancestor);if(parent===ancestor)throw error;ancestor=parent;}}
  const delta=relative(root,ancestor);
  if(delta==='..'||delta.startsWith('..'+(process.platform==='win32'?'\\':'/'))||isAbsolute(delta))throw new Error('Asset resolves outside project: '+value);
  return destination;
}

export function classicPlan(manifest) {
  if(manifest?.schemaVersion!==2||!manifest.assets||required.some(id=>!manifest.assets[id]))throw new Error('Expected schema-2 current Classic manifest with all six asset families.');
  const expected=new Map();
  const add=(path,id,width,extension)=>expected.set(path,{id,width,extension});
  add('assets/images/icon.png',required[0],1024,'.png');
  add('assets/images/android-icon-foreground.png',required[1],432,'.png');
  add('assets/images/android-icon-background.png',required[1],432,'.png');
  add('assets/images/android-icon-monochrome.png',required[2],432,'.png');
  add('assets/images/splash-icon.png',required[3],288,'.png');
  add('modules/remilo-alarm/android/src/main/res/drawable/ic_remilo_notification.xml',required[4],24,'.xml');
  add('assets/images/favicon.png',required[5],48,'.png');
  densities.forEach((density,index)=>{
    for(const name of ['ic_launcher','ic_launcher_round'])add(`android/app/src/main/res/mipmap-${density}/${name}.webp`,required[0],[48,72,96,144,192][index],'.webp');
    for(const name of ['foreground','background'])add(`android/app/src/main/res/mipmap-${density}/ic_launcher_${name}.png`,required[1],[108,162,216,324,432][index],'.png');
    add(`android/app/src/main/res/mipmap-${density}/ic_launcher_monochrome.png`,required[2],[108,162,216,324,432][index],'.png');
    add(`android/app/src/main/res/drawable-${density}/splashscreen_logo.png`,required[3],[288,432,576,864,1152][index],'.png');
  });
  const files=[],seen=new Set();
  for(const [assetId,asset] of Object.entries(manifest.assets)) {
    for(const output of Object.values(asset.outputs??{})) {
      portable(output.path);
      if(!output.path.startsWith('assets/brand/classic/')||!/^[a-f0-9]{64}$/.test(output.sha256??''))throw new Error('Invalid current Classic source path/hash.');
      for(const destination of output.copies??[]) {
        portable(destination);const wanted=expected.get(destination);
        if(seen.has(destination)||!wanted||wanted.id!==assetId||output.width!==wanted.width||output.height!==wanted.width||extname(output.path)!==wanted.extension)throw new Error('Missing, ambiguous or wrong-shape/format Classic mapping: '+destination);
        seen.add(destination);files.push({assetId,source:output.path,sha256:output.sha256,destination});
      }
    }
  }
  for(const target of expected.keys())if(!seen.has(target))throw new Error('Missing current Classic copy: '+target);
  return files;
}

export async function validateClassicSources(workspace,files,{sources=[]}={}) {
  const staged=new Map();
  for(const source of [...sources,...files.map(f=>({path:f.source,sha256:f.sha256}))]) {
    const target=await boundedPath(workspace,source.path);
    if(!staged.has(source.path))staged.set(source.path,Buffer.from(await readFile(target)));
    if(sha(staged.get(source.path))!==source.sha256)throw new Error('Current Classic source hash differs: '+source.path);
  }
  for(const file of files)await boundedPath(workspace,file.destination);
  for(const value of selectorPaths)await boundedPath(workspace,value);
  return staged;
}

async function publishBytes(target,bytes) {
  try {if((await readFile(target)).equals(bytes))return;}catch(error){if(error.code!=='ENOENT')throw error;}
  await mkdir(dirname(target),{recursive:true});
  const temporary=target+'.'+process.pid+'.asset-tmp';let created=false;
  try {
    const handle=await open(temporary,'wx');created=true;
    try {await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
    await rename(temporary,target);
  }finally{if(created)await rm(temporary,{force:true});}
}

export async function copyClassic(workspace,manifest,{check=false}={}) {
  const current=structuredClone(manifest),manifestPath=await boundedPath(workspace,'assets/brand/classic/manifest.json');
  const manifestBytes=await readFile(manifestPath);
  if(JSON.stringify(JSON.parse(manifestBytes.toString('utf8')))!==JSON.stringify(current))throw new Error('Current Classic manifest changed before staging.');
  const files=classicPlan(current);
  const sources=Object.values(current.assets).flatMap(asset=>Object.values(asset.sources??{}));
  // Snapshot and validate the complete input set; publication never rereads source pixels.
  const staged=await validateClassicSources(workspace,files,{sources});
  const publications=files.map(file=>({destination:file.destination,bytes:staged.get(file.source)}));
  publications.push(...selectorPaths.map(destination=>({destination,bytes:Buffer.from(adaptiveSelector)})));
  // Catch concurrent input/manifest changes during staging before any active writes.
  for(const [source,bytes] of staged)if(sha(await readFile(await boundedPath(workspace,source)))!==sha(bytes))throw new Error('Current Classic source changed during staging: '+source);
  if(!(await readFile(manifestPath)).equals(manifestBytes))throw new Error('Current Classic manifest changed during staging.');
  for(const item of publications) {
    const target=await boundedPath(workspace,item.destination);
    if(check) {
      if(!(await readFile(target)).equals(item.bytes))throw new Error('Classic copy or selector differs: '+item.destination);
      if(/mipmap-.*\/ic_launcher_(foreground|background|monochrome)\.png$/.test(item.destination)) {
        let collision=false;try {await access(target.replace(/\.png$/,'.webp'));collision=true;}catch(error){if(error.code!=='ENOENT')throw error;}
        if(collision)throw new Error('Duplicate Android resource format: '+item.destination);
      }
    } else {
      await publishBytes(target,item.bytes);
      if(/mipmap-.*\/ic_launcher_(foreground|background|monochrome)\.png$/.test(item.destination))await rm(target.replace(/\.png$/,'.webp'),{force:true});
    }
  }
  return files;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const flags=process.argv.slice(2);
  if(flags.includes('--help'))console.log('node scripts/brand.mjs [--check]\nCopy current Classic manifest bytes; --check is read-only. No image generation, Prebuild or installation.');
  else try {
    if(flags.some(flag=>flag!=='--check'))throw new Error('Unknown option; use --help');
    const workspace=fileURLToPath(new URL('../',import.meta.url));
    const manifest=JSON.parse(await readFile(join(workspace,'assets/brand/classic/manifest.json'),'utf8'));
    const files=await copyClassic(workspace,manifest,{check:flags.includes('--check')});console.log('Validated '+files.length+' current Classic copies.');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
