import fs from 'node:fs';
import crypto from 'node:crypto';
const path="C:/Users/Leo/Documents/Codex/2026-10-08/based-on-these-specs-generate-images/remilo-r10-data-help/generation/calls-r2-05-06-14.json";
const data=JSON.parse(fs.readFileSync(path,'utf8'));
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const row of data.selected){const b=fs.readFileSync(row.outputPath); const hash=digest(row.outputPath), sourceSha256=digest(row.sourcePath); row.raster={width:b.readUInt32BE(16),height:b.readUInt32BE(20),sha256:hash,sourceSha256,unchangedCopy:hash===sourceSha256}; if(hash!==sourceSha256)throw Error('copy differed');}
for(const call of data.calls){const b=fs.readFileSync(call.returnedSourcePath);call.outputSha256=digest(call.returnedSourcePath);call.raster={width:b.readUInt32BE(16),height:b.readUInt32BE(20)};call.references=call.referenced_image_paths.map(p=>({path:p,sha256:digest(p)}));}
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify(data.selected.map(x=>({id:x.id,...x.raster}))));

