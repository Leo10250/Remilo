// Current asset integrity and presentation consistency; no Git or historical evidence.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { classicPlan, adaptiveSelector, selectorPaths } from './brand.mjs';
const repository=path.resolve(import.meta.dirname,'..');
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifests={atmospheres:'assets/atmospheres/manifest.json',brand:'assets/brand/classic/manifest.json',exercises:'assets/exercises/manifest.json'};
const readJson=(root,file)=>JSON.parse(fs.readFileSync(localPath(root,file),'utf8').replace(/^\uFEFF/,''));
export function localPath(root,file) {
 if(typeof file!=='string'||!file||path.isAbsolute(file)||file.includes('\\')||/^[a-z]+:/i.test(file)||file.split('/').some(p=>!p||p==='..'||p==='.'))throw new Error('Expected portable repository-relative path.');
 const destination=path.resolve(root,file),delta=path.relative(fs.realpathSync(root),fs.realpathSync(destination));
 if(delta==='..'||delta.startsWith('..'+path.sep)||path.isAbsolute(delta))throw new Error('Asset resolves outside repository.');
 return destination;
}
// Header checks establish encoded shape; decoded pixel/color review belongs to the image helper.
export function imageMetadata(bytes) {
  if (bytes.length >= 26 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR') {
    return { format: 'PNG', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), hasAlpha: [4, 6].includes(bytes[25]), lossless: true };
  }
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Expected PNG or complete WebP image.');
  let width, height, hasAlpha = false, lossless = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), data = offset + 8;
    if (data + size > bytes.length) throw new Error('Truncated WebP chunk.');
    if (type === 'VP8X' && size >= 10) {
      hasAlpha ||= Boolean(bytes[data] & 0x10);
      width = bytes.readUIntLE(data + 4, 3) + 1;
      height = bytes.readUIntLE(data + 7, 3) + 1;
    } else if (type === 'VP8L' && size >= 5 && bytes[data] === 0x2f) {
      const bits = bytes.readUInt32LE(data + 1);
      width ??= (bits & 0x3fff) + 1;
      height ??= ((bits >>> 14) & 0x3fff) + 1;
      hasAlpha ||= Boolean(bits & 0x10000000);
      lossless = true;
    } else if (type === 'VP8 ' && size >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      width ??= bytes.readUInt16LE(data + 6) & 0x3fff;
      height ??= bytes.readUInt16LE(data + 8) & 0x3fff;
    }
    offset = data + size + (size % 2);
  }
  if (!width || !height) throw new Error('WebP image dimensions are missing.');
  return { format: 'WebP', width, height, hasAlpha, lossless };
}

/** Structural checks for Android's white 24 dp notification alpha silhouette. */
export function vectorMetadata(bytes) {
  const source = bytes.toString('utf8').replace(/^\uFEFF/, '').replace(/^\s*<\?xml\s+[^?]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (/<!|<\?|&/.test(source)) throw new Error('Notification vector cannot contain declarations, entities or processing instructions.');
  const stack = [], tags = [...source.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)([^<>]*?)>/g)];
  let offset = 0, root, paths = 0;
  const white = (color) => /^#(?:FFFFFF|FFFFFFFF)$/i.test(color ?? '');
  for (const match of tags) {
    if (source.slice(offset, match.index).trim()) throw new Error('Unexpected notification vector content.');
    offset = match.index + match[0].length;
    const [, closing, name, rest] = match;
    if (!['vector', 'group', 'path'].includes(name)) throw new Error('Unsupported notification vector element: ' + name);
    if (closing) {
      if (rest.trim() || stack.pop() !== name) throw new Error('Unbalanced notification vector XML.');
      continue;
    }
    const selfClosing = /\/\s*$/.test(rest), raw = rest.replace(/\/\s*$/, ''), attributes = {};
    let cursor = 0;
    for (const item of raw.matchAll(/([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      if (raw.slice(cursor, item.index).trim() || Object.hasOwn(attributes, item[1])) throw new Error('Malformed or duplicate notification vector attribute.');
      attributes[item[1]] = item[2] ?? item[3]; cursor = item.index + item[0].length;
    }
    if (raw.slice(cursor).trim()) throw new Error('Malformed notification vector attribute.');
    if (!root) {
      if (name !== 'vector') throw new Error('Expected Android vector root.');
      root = attributes;
    } else if (!stack.length || name === 'vector') throw new Error('Expected one notification vector root.');
    if (name === 'path') {
      if (!(white(attributes['android:fillColor']) || white(attributes['android:strokeColor'])) ||
        Object.entries(attributes).some(([key, value]) => ['android:fillColor', 'android:strokeColor'].includes(key) && !white(value))) throw new Error('Notification paths must use white alpha fill/stroke only.');
      if (!/^[Mm][MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/.test(attributes['android:pathData'] ?? '')) throw new Error('Notification path geometry is missing or invalid.');
      for (const key of ['android:fillAlpha', 'android:strokeAlpha']) if (attributes[key] != null && (!Number.isFinite(Number(attributes[key])) || Number(attributes[key]) < 0 || Number(attributes[key]) > 1)) throw new Error('Notification path alpha must be between zero and one.');
      paths++;
    }
    if (!selfClosing) stack.push(name);
  }
  if (source.slice(offset).trim() || stack.length || !root || !paths) throw new Error('Incomplete notification vector XML.');
  if (root['xmlns:android'] !== 'http://schemas.android.com/apk/res/android' || root['android:width'] !== '24dp' || root['android:height'] !== '24dp' || Number(root['android:viewportWidth']) !== 24 || Number(root['android:viewportHeight']) !== 24) throw new Error('Notification vector must use 24 dp dimensions and a 24 Ã— 24 viewport.');
  if (root['android:tint'] != null && !white(root['android:tint'])) throw new Error('Notification vector tint must be white.');
  return { format: 'AndroidVector', width: 24, height: 24, hasAlpha: true, whiteSilhouette: true, paths };
}

export function verifyAssets(root=repository,{generated=true}={}) {
 const findings=[],checks={sources:0,exports:0,copies:0,presentationPairs:0,generatedPresentationFiles:0};
 const add=(check,details)=>findings.push({check,...details});
 const current={},claimed=new Map();
 function file(record,kind) {
  try {
   if(!record||!/^[a-f0-9]{64}$/.test(record.sha256??''))throw new Error('Expected current SHA-256.');
   const bytes=fs.readFileSync(localPath(root,record.path));
   if(sha256(bytes)!==record.sha256)throw new Error('Current file hash differs.');
   const actual=record.path.endsWith('.xml')?vectorMetadata(bytes):imageMetadata(bytes);
   if(actual.format.toUpperCase()!==record.format?.toUpperCase()||actual.width!==record.width||actual.height!==record.height)throw new Error('Encoded format or dimensions differ.');
   if(!['opaque','transparent'].includes(record.alpha)||record.alpha==='transparent'&&!actual.hasAlpha)throw new Error('Alpha contract differs.');
   if(record.transform?.lossless===true&&!actual.lossless)throw new Error('Expected lossless encoded output.');
   checks[kind]++;return bytes;
  }catch(error){add('asset-file',{path:record?.path,message:error.message});return null;}
 }
 for(const [name,value] of Object.entries(manifests)) {
  try {
   const manifest=readJson(root,value);
   if(manifest.schemaVersion!==2||!manifest.assets||Array.isArray(manifest.assets)||Object.keys(manifest).some(k=>!['schemaVersion','assets'].includes(k)))throw new Error('Expected schema-2 current-only asset manifest.');
   current[name]=manifest;
   for(const [id,asset] of Object.entries(manifest.assets)) {
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||!asset.sources||!asset.outputs||Object.keys(asset).some(k=>!['sources','outputs','notes'].includes(k)))throw new Error('Invalid current asset entry: '+id);
    for(const source of Object.values(asset.sources))file(source,'sources');
    for(const [role,output] of Object.entries(asset.outputs)) {
     if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(role)||!asset.sources[output.source]||!output.transform||!['raster','copy','crop-resize','resize','uniform-affine','splash-density-affine'].includes(output.transform.kind)||!Array.isArray(output.copies))throw new Error('Invalid output recipe: '+id+'/'+role);
     const original=file(output,'exports');
     for(const target of [output.path,...output.copies]) {
      if(claimed.has(target))throw new Error('Conflicting output destination: '+target);
      claimed.set(target,id+'/'+role);
     }
     for(const target of output.copies) {
      try {const bytes=fs.readFileSync(localPath(root,target));if(!original||!bytes.equals(original))throw new Error('Copy differs from current export.');checks.copies++;}
      catch(error){add('asset-copy',{path:target,message:error.message});}
     }
    }
   }
  }catch(error){add('asset-manifest',{path:value,message:error.message});}
 }
 try {
  classicPlan(current.brand);
  for(const target of selectorPaths)if(fs.readFileSync(localPath(root,target),'utf8')!==adaptiveSelector)add('brand-selector',{path:target});
  for(const target of claimed.keys())if(/mipmap-.*\/ic_launcher_(foreground|background|monochrome)\.png$/.test(target)&&fs.existsSync(path.join(root,target.replace(/\.png$/,'.webp'))))add('brand-resource-collision',{path:target});
 }catch(error){add('brand-layout',{message:error.message});}
 try {
  const canonical=readJson(root,'assets/atmospheres/presentation.json');
  const pairs=Object.entries(canonical.pairs??{}), scenes=current.atmospheres?.assets??{};
  const expected=['sunrise','sky','evening','night'].flatMap(s=>['light','dark'].map(b=>`${s}-${b}`));
  if(pairs.length!==expected.length||expected.some(id=>!canonical.pairs[id]||!scenes[id])||Object.keys(scenes).length!==expected.length)throw new Error('Expected the current four atmosphere pairs.');
  const components=fs.readFileSync(localPath(root,'src/ui/components.tsx'),'utf8');
  const imports=new Map([...components.matchAll(/'([^']+)'\s*:\s*require\('\.\.\/\.\.\/(assets\/atmospheres\/[^']+)'\)/g)].map(m=>[m[1],m[2]]));
  for(const [id,pair] of pairs) {
   const output=scenes[id]?.outputs.runtime,native=output?.copies?.[0];
   if(!output||pair.asset!==path.posix.basename(output.path)||pair.native!==path.posix.basename(native??'','.webp')||imports.get(id)!==output.path)throw new Error('Runtime scene selection differs: '+id);
   if(output.width!==1440||output.height!==810||output.format!=='WEBP'||output.alpha!=='opaque'||output.transform.lossless!==true||output.copies.length!==1||native!==`modules/remilo-alarm/android/src/main/res/drawable-nodpi/${pair.native}.webp`)throw new Error('Scene runtime format/copy contract differs: '+id);
   for(const role of ['heroFocal','compactFocal'])if(!Array.isArray(pair[role])||pair[role].length!==2||pair[role].some(n=>!Number.isFinite(n)||n<0||n>1))throw new Error('Invalid presentation focal coordinates: '+id);
   const roles={...pair,...canonical.semantic?.[id.endsWith('-dark')?'dark':'light']};
   for(const role of ['canvas','surface','onSurface','onSurfaceVariant','primary','onPrimary','container','outline','error','onError','warning','success','disabledSurface','disabledInk','inverseSurface','inverseInk','inverseAction'])if(!/^#[0-9a-f]{6}$/i.test(roles[role]??''))throw new Error('Invalid presentation role: '+id+'/'+role);
   const header=canonical.header?.[id];if(!header||!/^#[0-9a-f]{6}$/i.test(header.ink)||!/^#[0-9a-f]{6}$/i.test(header.scrim)||!Number.isFinite(header.scrimAlpha)||header.scrimAlpha<0||header.scrimAlpha>1)throw new Error('Invalid header roles: '+id);
   checks.presentationPairs++;
  }
  if(imports.size!==pairs.length)throw new Error('RN scene map differs from current presentation pairs.');
  if(generated) {
   cp.execFileSync(process.execPath,[path.join(root,'scripts/presentation.mjs'),'--check'],{cwd:root,encoding:'utf8',stdio:'pipe'});
   checks.generatedPresentationFiles=4;
  }
 }catch(error){add('presentation',{message:String(error.stderr||error.message).trim()});}
 try {
  const catalog=fs.readFileSync(localPath(root,'src/ui/exercise-illustrations.tsx'),'utf8');
  const consumers=[...catalog.matchAll(/source:\s*require\('\.\.\/\.\.\/(assets\/exercises\/[^']+)'\)/g)].map(m=>m[1]);
  const exports=Object.values(current.exercises?.assets??{}).map(a=>a.outputs.runtime?.path);
  if(!consumers.length||new Set(consumers).size!==consumers.length||exports.length!==consumers.length||new Set(exports).size!==exports.length||consumers.some(p=>!exports.includes(p)))throw new Error('Current illustration catalog and runtime exports differ.');
  for(const asset of Object.values(current.exercises.assets)) {
   const output=asset.outputs.runtime;
   if(output.width!==960||output.height!==540||output.alpha!=='transparent'||output.transform.lossless!==true)throw new Error('Illustration runtime contract differs.');
  }
 }catch(error){add('exercise-selection',{message:error.message});}
 return {verification:'current assets and presentation',checks,findings};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const flags=process.argv.slice(2);
 if(flags.includes('--help'))console.log('npm run verify:assets\nRead-only current source/export hashes, active copies and presentation consistency. No Git history or network.');
 else try {if(flags.length)throw new Error('Unknown option; use --help');const result=verifyAssets();console.log(JSON.stringify(result,null,2));if(result.findings.length)process.exitCode=1;}
 catch(error){console.log(JSON.stringify({findings:[{check:'input',message:error.message}]}));process.exitCode=1;}
}
