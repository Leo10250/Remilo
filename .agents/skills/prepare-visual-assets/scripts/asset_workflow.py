"""Local staging, review and current-manifest publication. No historical registry."""
from __future__ import annotations
import argparse, copy, hashlib, json, os, shutil, sys, tempfile, xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image, ImageDraw
from asset_common import (AssetError, atomic_json, confined, digest, encode_image, font,
    inspect_image, load_json, pixels_equal, preview_fit, relative, render_export, require, sha, validate_id)


def profile_roots(root, profile):
    require(profile.get('schemaVersion') == 2, 'Migrate the profile to schemaVersion 2; historical approval profiles are unsupported')
    require(isinstance(profile.get('manifests'), dict) and profile['manifests'], 'Profile requires named current manifests')
    require(isinstance(profile.get('allowedOutputRoots'), list) and profile['allowedOutputRoots'], 'Profile requires allowed output roots')
    local = confined(root, profile['localRoot'], profile['allowedOutputRoots'])
    require(local != root, 'Local working root must be a child directory')
    return local


def production_path(root,profile,value):
    require(isinstance(value,str) and value and not value.startswith('/') and '\\' not in value and ':' not in value and all(part not in ('','.','..') for part in value.split('/')), 'Production paths must be portable and cannot escape the project')
    return confined(root,value,profile['allowedOutputRoots'])


def manifest_file(root, profile, value):
    profile_roots(root, profile)
    configured = profile['manifests']
    value = configured.get(value, value)
    require(value in configured.values(), 'Select an explicitly configured manifest with --manifest')
    path = production_path(root,profile,value)
    return path


def manifest_snapshot(path):
    raw=Path(path).read_bytes()
    data=json.loads(raw.decode('utf-8-sig'))
    require(data.get('schemaVersion') == 2 and isinstance(data.get('assets'), dict), 'Migrate the manifest to schemaVersion 2; historical registries are unsupported')
    return data,hashlib.sha256(raw).hexdigest()


def current_manifest(path):
    return manifest_snapshot(path)[0]


def local_file(root, profile, value):
    path = confined(root, value)
    require(path.is_relative_to(profile_roots(root, profile)), 'Working records must remain under localRoot')
    return path


def input_file(root, value):
    path = Path(value)
    path = path.resolve() if path.is_absolute() else confined(root, value)
    require(path.is_file(), f'Input file missing: {path}')
    return path


def measured(path):
    if path.suffix.lower() == '.xml':
        element = ET.fromstring(path.read_text(encoding='utf-8'))
        ns='{http://schemas.android.com/apk/res/android}'
        require(element.tag == 'vector', 'Expected Android vector')
        return {'sha256':sha(path),'format':'ANDROIDVECTOR','width':float(element.get(ns+'width','0dp').removesuffix('dp')),
                'height':float(element.get(ns+'height','0dp').removesuffix('dp')),'alpha':'transparent'}
    facts = inspect_image(path)
    return {k:facts[k] for k in ('sha256','format','width','height')} | {'alpha':'opaque' if facts['opaque'] else 'transparent'}


def file_facts(root, record, *, copies=True):
    path = confined(root, record['path'])
    require(path.is_file() and sha(path) == record['sha256'], f'Current file hash differs: {record["path"]}')
    facts = measured(path)
    for key in ('width','height','alpha'):
        require(record.get(key) == facts[key], f'{key} differs: {record["path"]}')
    require(record['format'].upper() == facts['format'].upper(), f'Format differs: {record["path"]}')
    if copies:
        for target in record.get('copies', []):
            require(sha(confined(root,target)) == record['sha256'], f'Copy differs: {target}')
    return facts


def raster_output(root, asset, output, sources, destination):
    require(output['source'] in sources, 'Output source role is missing')
    source = sources[output['source']]
    recipe = output['transform']
    if recipe['kind'] == 'copy':
        shutil.copyfile(source,destination)
    else:
        require(recipe['kind'] == 'raster', 'Use the project exporter for this transformation')
        image, _ = render_export(source, {**recipe,'size':[output['width'],output['height']]})
        encode_image(image,destination,output['format'],recipe.get('lossless',True))


def asset_destinations(asset, root=None, profile=None):
    claims={}
    for kind,entries in (('source',asset['sources']),('output',asset['outputs'])):
        for entry in entries.values():
            for target in [entry['path'],*entry.get('copies',[])]:
                # Resolved Paths account for symlinks and the host's case semantics.
                if root is not None:target=production_path(root,profile,target)
                identity=entry.get('sha256')
                if target in claims:require(claims[target]['sha256'] == identity, 'Conflicting bytes planned at one asset destination')
                claims[target]={'sha256':identity,'kind':kind}
    return claims


def validate_ownership(root,profile,manifest_path,asset_id,asset):
    proposed=asset_destinations(asset,root,profile)
    snapshots={}
    for value in set(profile['manifests'].values()):
        path=manifest_file(root,profile,value)
        manifest,identity=manifest_snapshot(path);snapshots[relative(root,path)]=identity
        for other_id,other in manifest['assets'].items():
            if path == manifest_path and other_id == asset_id:continue
            for target,claim in asset_destinations(other,root,profile).items():
                if target not in proposed:continue
                planned=proposed[target]
                require(not (planned['kind']=='output' and claim['kind']=='output'), f'Output destination belongs to another asset: {target}')
                require(planned['sha256']==claim['sha256'], f'Shared source bytes belong to another asset: {target}')
    return snapshots


def stage_asset(root, profile, args, renderer=raster_output, renderer_name='raster'):
    root = Path(root).resolve()
    local = profile_roots(root,profile)
    asset_id = validate_id(args.asset)
    run = validate_id(args.run)
    manifest_path = manifest_file(root,profile,args.manifest)
    manifest,manifest_identity = manifest_snapshot(manifest_path)
    spec = load_json(input_file(root,args.spec)) if getattr(args,'spec',None) else copy.deepcopy(manifest['assets'].get(asset_id))
    require(isinstance(spec,dict) and spec.get('sources') and spec.get('outputs'), 'Asset needs sources and outputs; new assets require --spec')
    directory = local / run
    require(not directory.exists(), 'Run ID already exists; choose another local run ID')
    source_inputs = {}
    source_identities = {}
    override = getattr(args,'source',None)
    override_role = getattr(args,'source_role','master')
    if override:
        require(override_role in spec['sources'], 'Replacement source role is missing')
    for role, entry in spec['sources'].items():
        validate_id(role)
        source = input_file(root,override if override and role == override_role else entry['path'])
        identity = sha(source)
        if not (override and role == override_role):
            require(identity == entry['sha256'], 'Current source hash differs; do not rebaseline changed bytes silently')
        source_inputs[role]=source
        source_identities[role]=identity
    # Validate every declared target before creating a local run.
    destinations={}
    baselines={}
    for entry in [*spec['sources'].values(),*spec['outputs'].values()]:
        for target in [entry['path'],*entry.get('copies',[])]:
            path=production_path(root,profile,target)
            require(not path.is_relative_to(local) and path != manifest_path, 'Production target conflicts with working storage or manifest')
            if path not in baselines:baselines[path]=sha(path) if path.exists() else None
    ownership_spec=copy.deepcopy(spec)
    for role,identity in source_identities.items():ownership_spec['sources'][role]['sha256']=identity
    for output in ownership_spec['outputs'].values():
        if output['transform']['kind']=='copy':output['sha256']=ownership_spec['sources'][output['source']]['sha256']
    validate_ownership(root,profile,manifest_path,asset_id,ownership_spec)
    directory.mkdir(parents=True)
    sources={}
    staged=[]
    def add_file(source,target):
        path=production_path(root,profile,target)
        identity=sha(source)
        require(path in baselines, 'Production destination changed while staging')
        if path in destinations:
            require(destinations[path] == identity, 'Two staged files conflict at one destination')
            return
        destinations[path]=identity
        staged.append({'path':relative(root,source),'destination':target,'sha256':identity,
                       'expectedSha256':baselines[path]})
    proposed=copy.deepcopy(spec)
    for role,source in source_inputs.items():
        saved=directory/'sources'/f'{role}{source.suffix.lower()}'
        saved.parent.mkdir(exist_ok=True)
        shutil.copyfile(source,saved)
        require(sha(saved) == source_identities[role], 'Source changed while staging; prepare a new run from the intended bytes')
        sources[role]=saved
        proposed['sources'][role].update(measured(saved))
        if override and role == override_role:proposed['sources'][role].pop('colorInterpretation',None)
        add_file(saved,proposed['sources'][role]['path'])
    for role,output in proposed['outputs'].items():
        validate_id(role)
        require(output.get('source') in sources and isinstance(output.get('copies',[]),list), 'Invalid output source/copies')
        destination=directory/'exports'/f'{role}{Path(output["path"]).suffix.lower()}'
        destination.parent.mkdir(exist_ok=True)
        renderer(root,asset_id,output,sources,destination)
        facts=measured(destination)
        for key in ('width','height','alpha'):
            require(output[key] == facts[key], f'Staged output violates {key}: {role}')
        require(output['format'].upper() == facts['format'].upper(), 'Staged format differs')
        output.update(facts)
        add_file(destination,output['path'])
        for target in output.get('copies',[]): add_file(destination,target)
    validate_ownership(root,profile,manifest_path,asset_id,proposed)
    for role,source in source_inputs.items():
        require(sha(source) == source_identities[role], 'Source changed while staging; prepare a new run from the intended bytes')
    for path,identity in baselines.items():
        require((sha(path) if path.exists() else None) == identity, f'Production target changed while staging: {path}')
    require(sha(manifest_path) == manifest_identity, 'Current manifest changed while staging')
    record={'schemaVersion':2,'runId':run,'assetId':asset_id,'manifest':relative(root,manifest_path),
            'expectedManifestSha256':manifest_identity,'profileSha256':digest(profile),
            'asset':proposed,'files':staged,'renderer':renderer_name}
    path=directory/'prepared.json'
    atomic_json(path,record)
    return {'record':relative(root,path),'stagedFiles':len(staged),'productionFilesWritten':False}


def verify_prepared(root,profile,path):
    path=local_file(root,profile,path)
    record=load_json(path)
    require(record.get('schemaVersion') == 2, 'Historical prepared records are unsupported; prepare a new schema-2 local run')
    require(path.parent == profile_roots(root,profile) / validate_id(record['runId']), 'Prepared record is outside its run directory')
    require(record['profileSha256'] == digest(profile), 'Profile changed after preparation')
    manifest_file(root,profile,record['manifest'])
    require(record['files'], 'Prepared run has no files')
    targets=set()
    for entry in record['files']:
        staged=local_file(root,profile,entry['path'])
        target=production_path(root,profile,entry['destination'])
        require(not target.is_relative_to(profile_roots(root,profile)), 'Production file cannot target working storage')
        require(target not in targets, 'Duplicate production target')
        targets.add(target)
        require(sha(staged) == entry['sha256'], 'Staged input/output bytes changed after preparation')
    require({production_path(root,profile,e['destination']):e['sha256'] for e in record['files']} == {p:c['sha256'] for p,c in asset_destinations(record['asset'],root,profile).items()}, 'Prepared files differ from the proposed asset destinations')
    return record


def review(root,profile,args):
    record_path=local_file(root,profile,args.record)
    record=verify_prepared(root,profile,record_path)
    review_id=validate_id(args.review_id)
    path=record_path.parent/f'review-{review_id}.json'
    require(not path.exists(), 'Review ID already exists')
    inspection=load_json(input_file(root,args.inspection)) if args.inspection else {'checks':[]}
    panels=[]
    # One actual decoded file per panel; vector work is inspected in its native tool.
    identities=set()
    for entry in record['files']:
        source=local_file(root,profile,entry['path'])
        if source.suffix.lower() == '.xml' or entry['sha256'] in identities:continue
        identities.add(entry['sha256'])
        with Image.open(source) as decoded:
            panel=preview_fit(decoded,(640,400))
        draw=ImageDraw.Draw(panel);draw.text((8,8),entry['destination'],fill='#18212f',font=font(13))
        target=record_path.parent/f'review-{review_id}-{len(panels)+1}.png'
        require(not target.exists(), 'Review preview already exists')
        panel.save(target)
        panels.append({'path':relative(root,target),'sha256':sha(target)})
    doc={'schemaVersion':2,'preparedSha256':sha(record_path),'panels':panels,'inspection':inspection}
    atomic_json(path,doc)
    return {'review':relative(root,path),'panels':panels,'inspection':inspection}


def atomic_copy(source,target,expected_sha256):
    target=Path(target);target.parent.mkdir(parents=True,exist_ok=True)
    temp=target.with_name(target.name+f'.{os.getpid()}.asset-tmp')
    created=False
    try:
        with temp.open('xb') as stream:
            created=True
            stream.write(Path(source).read_bytes());stream.flush();os.fsync(stream.fileno())
        require(sha(temp) == expected_sha256, 'Staged copy bytes changed before publication')
        os.replace(temp,target)
    finally:
        if created and temp.exists():temp.unlink()


def stage_backup(source,target,expected):
    if target.exists():
        require(sha(target) == expected, 'Recovery backup changed; inspect it before retrying')
        return
    target.parent.mkdir(parents=True,exist_ok=True)
    # Reserve our own temporary directory; never overwrite an unknown partial file.
    with tempfile.TemporaryDirectory(prefix='.backup-',dir=target.parent) as directory:
        stage=Path(directory)/'snapshot'
        shutil.copyfile(source,stage)
        require(sha(stage) == expected, 'Production target changed while backing up')
        if os.name == 'nt':os.rename(stage,target)
        else:os.link(stage,target)


def promote(root,profile,args):
    record_path=local_file(root,profile,args.record)
    record=verify_prepared(root,profile,record_path)
    review_path=local_file(root,profile,args.review)
    review_record=load_json(review_path)
    require(review_record.get('schemaVersion') == 2 and review_record.get('preparedSha256') == sha(record_path), 'Review is stale or belongs to another staged run')
    checks=review_record.get('inspection',{}).get('checks',[])
    require(checks and all(c.get('status') == 'pass' and c.get('observation','').strip() for c in checks), 'Complete actual visual inspection before integration')
    for panel in review_record.get('panels',[]):
        require(sha(local_file(root,profile,panel['path'])) == panel['sha256'], 'Presented review preview changed')
    local=profile_roots(root,profile);lock=local/'.publish.lock'
    journal_path=record_path.parent/'publication.json'
    local.mkdir(parents=True,exist_ok=True)
    try:
        with lock.open('x') as stream:stream.write(str(os.getpid()))
    except FileExistsError as exc:
        raise AssetError('Another publication lock exists; inspect it before recovery') from exc
    try:
        manifest_path=manifest_file(root,profile,record['manifest'])
        current=current_manifest(manifest_path)
        journal=load_json(journal_path) if journal_path.exists() else None
        identity={'preparedSha256':sha(record_path),'reviewSha256':sha(review_path)}
        if journal:
            require(journal['identity'] == identity, 'Interrupted publication belongs to different reviewed data')
            manifest_stage=local_file(root,profile,journal['manifestStage'])
            require(sha(manifest_stage) == journal['newManifestSha256'], 'Interrupted manifest stage changed')
            new_manifest=load_json(manifest_stage)
        else:
            if current['assets'].get(record['assetId']) == record['asset'] and all(sha(confined(root,e['destination'])) == e['sha256'] for e in record['files']):
                return {'assetId':record['assetId'],'alreadyApplied':True}
            require(sha(manifest_path) == record['expectedManifestSha256'], 'Current manifest changed after preparation')
            new_manifest=copy.deepcopy(current);new_manifest['assets'][record['assetId']]=record['asset']
        ownership=validate_ownership(root,profile,manifest_path,record['assetId'],record['asset'])
        # Validate the complete target set before any production mutation, including recovery.
        for entry in record['files']:
            target=production_path(root,profile,entry['destination'])
            actual=sha(target) if target.exists() else None
            allowed={entry['expectedSha256'],entry['sha256']} if journal else {entry['expectedSha256']}
            require(actual in allowed, f'Production target changed: {entry["destination"]}')
        for name,identity_hash in ownership.items():
            require(sha(manifest_file(root,profile,name)) == identity_hash, 'Asset ownership changed during publication')
        if not journal:
            stage=local_file(root,profile,relative(root,record_path.parent/'manifest.json'))
            expected_bytes=(json.dumps(new_manifest,indent=2,ensure_ascii=False)+'\n').encode('utf-8')
            if stage.exists():
                require(stage.read_bytes() == expected_bytes, 'Interrupted manifest stage changed')
            else:atomic_json(stage,new_manifest)
            backups=confined(root,relative(root,record_path.parent/'backups'))
            require(backups.is_relative_to(local), 'Recovery backups escape local working storage')
            for index,entry in enumerate(record['files']):
                target=confined(root,entry['destination'])
                if target.exists():
                    stage_backup(target,backups/str(index),entry['expectedSha256'])
            journal={'identity':identity,'manifestStage':relative(root,stage),'newManifestSha256':sha(stage)}
            atomic_json(journal_path,journal)
        require(sha(manifest_path) in {record['expectedManifestSha256'],journal['newManifestSha256']}, 'Manifest changed during interrupted publication')
        for entry in record['files']:
            target=production_path(root,profile,entry['destination'])
            actual=sha(target) if target.exists() else None
            require(actual in {entry['expectedSha256'],entry['sha256']}, 'Production target changed during publication')
            if actual != entry['sha256']:
                atomic_copy(local_file(root,profile,entry['path']),target,entry['sha256'])
            require(sha(target) == entry['sha256'], 'Published bytes differ')
        require(sha(local_file(root,profile,journal['manifestStage'])) == journal['newManifestSha256'], 'Manifest stage changed before publication')
        require(sha(manifest_path) in {record['expectedManifestSha256'],journal['newManifestSha256']}, 'Manifest changed before publication')
        atomic_copy(local_file(root,profile,journal['manifestStage']),manifest_path,journal['newManifestSha256'])
        require(sha(manifest_path) == journal['newManifestSha256'], 'Published manifest differs')
        journal_path.unlink()
        backups=confined(root,relative(root,record_path.parent/'backups'))
        require(backups.is_relative_to(record_path.parent), 'Recovery backups escape this run')
        if backups.exists():shutil.rmtree(backups)
        return {'assetId':record['assetId'],'files':len(record['files']),'manifest':record['manifest']}
    finally:
        lock.unlink()


def audit(root,profile,args):
    findings=[];files=0
    for name,value in profile['manifests'].items():
        try:
            manifest=current_manifest(manifest_file(root,profile,value))
            for asset_id,asset in manifest['assets'].items():
                try:validate_ownership(root,profile,manifest_file(root,profile,value),asset_id,asset)
                except (ValueError,OSError,KeyError) as error:findings.append(str(error))
                for record in [*asset['sources'].values(),*asset['outputs'].values()]:
                    try:file_facts(root,record);files+=1
                    except (ValueError,OSError,KeyError,ET.ParseError) as error:findings.append(str(error))
        except (ValueError,OSError,KeyError) as error:findings.append(f'{name}: {error}')
    result={'filesChecked':files,'findings':findings}
    if args.report:atomic_json(local_file(root,profile,args.report),result)
    return result


def parser():
    p=argparse.ArgumentParser(description='Prepare images in local working storage; publish only current manifests and assets.')
    sub=p.add_subparsers(dest='operation',required=True)
    for op in ('inspect','prepare','review','promote','audit'):
        command=sub.add_parser(op)
        command.add_argument('--project-root',required=True);command.add_argument('--profile',required=True)
        if op == 'inspect':command.add_argument('--source',required=True)
        if op == 'prepare':
            for key in ('manifest','asset','run'):command.add_argument('--'+key,required=True)
            command.add_argument('--source');command.add_argument('--source-role',default='master');command.add_argument('--spec')
        if op in ('review','promote'):command.add_argument('--record',required=True)
        if op == 'review':
            command.add_argument('--review-id',required=True);command.add_argument('--inspection')
        if op == 'promote':command.add_argument('--review',required=True)
        if op == 'audit':command.add_argument('--report')
    return p


def main():
    args=parser().parse_args();root=Path(args.project_root).resolve();profile=load_json(confined(root,args.profile));profile_roots(root,profile)
    if args.operation == 'inspect':result=measured(input_file(root,args.source))
    elif args.operation == 'prepare':result=stage_asset(root,profile,args)
    else:result={'review':review,'promote':promote,'audit':audit}[args.operation](root,profile,args)
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if result.get('findings'):sys.exit(1)


if __name__ == '__main__':
    try:main()
    except (ValueError,OSError,KeyError,ET.ParseError) as error:
        print(json.dumps({'error':str(error)},ensure_ascii=False));sys.exit(1)
