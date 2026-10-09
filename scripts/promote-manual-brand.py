"""Activate explicitly reviewed manual Classic exports; never infers artwork approval.

Distinct sources/outputs are declared in a hashed specification and configured
in the project profile. Publication preserves candidate bytes. This is the
manual layer lane; the single-source raster helper still cannot infer layers.
"""
from __future__ import annotations
import argparse, copy, hashlib, json, os, shutil, sys, re, io, xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image,ImageDraw

REPOSITORY=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(REPOSITORY/'.agents/skills/prepare-visual-assets/scripts'))
from asset_common import atomic_json, confined, inspect_image, load_json, now, pixels_equal, relative, require, sha, utc_timestamp

def inspect_vector(path):
    """Inspect native vector structure/white geometry; never claims raster conformance."""
    source=path.read_text(encoding='utf-8')
    require(not re.search(r'<!|<\?|&',source),'Vector declarations/entities are unsupported')
    try: root=ET.fromstring(source)
    except ET.ParseError as error: raise ValueError('Invalid Android vector XML') from error
    ns='{http://schemas.android.com/apk/res/android}'
    require(root.tag=='vector' and root.attrib.get(ns+'width')=='24dp' and root.attrib.get(ns+'height')=='24dp'
            and root.attrib.get(ns+'viewportWidth')=='24' and root.attrib.get(ns+'viewportHeight')=='24','Native notification vector requires24dp/viewport24')
    require(root.attrib.get(ns+'tint','#FFFFFFFF').upper() in ('#FFFFFF','#FFFFFFFF'),'Native vector tint must be white')
    paths=[]
    for element in root.iter():
        require(element.tag in ('vector','group','path'),'Unsupported native vector element')
        require(not (element.text or '').strip() and not (element.tail or '').strip(),'Unexpected vector text')
        if element.tag!='path':continue
        color=[element.attrib[k] for k in (ns+'fillColor',ns+'strokeColor') if k in element.attrib]
        require(bool(color) and all(v.upper() in ('#FFFFFF','#FFFFFFFF') for v in color),'Native vector paths must be white')
        data=element.attrib.get(ns+'pathData','')
        require(bool(re.fullmatch(r'[Mm][MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+',data)),'Invalid native vector geometry')
        for key in (ns+'fillAlpha',ns+'strokeAlpha'):
            if key in element.attrib:require(0<=float(element.attrib[key])<=1,'Invalid native vector alpha')
        paths.append(data)
    require(bool(paths),'Native vector has no paths')
    return {'width':24,'height':24,'opaque':False,'format':'AndroidVector','whiteSilhouette':True,'pathCount':len(paths)}

def manual_pixels(source, specification):
    with Image.open(source) as raw:
        im=raw.convert('RGBA' if 'A' in raw.getbands() else 'RGB')
    target=tuple(specification['size'])
    require(len(target)==2 and all(isinstance(v,int) and v>0 for v in target),'Invalid manual export size')
    if specification['kind']=='crop-resize':
        rect=specification['sourceRectPx']
        require(len(rect)==4 and all(isinstance(v,int) for v in rect) and 0<=rect[0]<rect[2]<=im.width and 0<=rect[1]<rect[3]<=im.height,'Manual source crop exceeds original pixels')
        cropped=im.crop(rect)
        require(specification.get('allowUpscale') is True or all(t<=s for t,s in zip(target,cropped.size)),'Manual crop resize would enlarge source')
        require(max(target)<=1024,'Manual branding exceeds declared configuration size')
        result=cropped.resize(target,Image.Resampling.LANCZOS)
        if specification.get('mask'):
            require(specification['mask']=='circle' and target[0]==target[1],'Unsupported manual crop mask')
            n=target[0];mask=Image.new('L',(n*4,n*4),0);ImageDraw.Draw(mask).ellipse((0,0,n*4-1,n*4-1),fill=255)
            result=result.convert('RGBA');result.putalpha(mask.resize(target,Image.Resampling.LANCZOS))
        if specification.get('transparentRgbPolicy'):
            require(specification['transparentRgbPolicy']=='zero' and result.mode=='RGBA','Unknown transparent RGB policy')
            visible=result.getchannel('A').point(lambda a:255 if a else 0)
            normalized=Image.new('RGBA',result.size,(0,0,0,0));normalized.paste(result,(0,0),visible);result=normalized
        if specification.get('losslessWebpEncoding'):
            require(specification['losslessWebpEncoding']=={'method':6,'exact':False},'Unknown lossless WebP encoding policy')
            encoded=io.BytesIO();result.save(encoded,format='WebP',lossless=True,method=6,exact=False);encoded.seek(0)
            with Image.open(encoded) as decoded:result=decoded.copy()
        return result
    if specification['kind']=='resize':
        require(all(t<=s for t,s in zip(target,im.size)),'Manual resize would enlarge source')
        return im.resize(target,Image.Resampling.LANCZOS)
    require(specification['kind']=='uniform-affine','Unknown manual export transformation')
    require(target[0]==target[1] and im.mode=='RGBA','Uniform affine requires a square transparent layer')
    center=specification['sourceCenterPx']
    require(len(center)==2 and all(isinstance(v,(int,float)) and __import__('math').isfinite(v) for v in center),'Invalid affine center')
    k=specification['dpPerSourcePx']*target[0]/specification['layerSizeDp']
    require(0<k<=1,'Uniform affine must not enlarge source detail')
    coefficients=(1/k,0,center[0]-target[0]/2/k,0,1/k,center[1]-target[1]/2/k)
    return im.transform(target,Image.Transform.AFFINE,coefficients,resample=Image.Resampling.BICUBIC)

def validate(root,profile,specification,decision):
    require(specification['schemaVersion']==1 and decision.get('promote') is True and decision.get('activationApproved') is True,'Explicit artwork and integration decision is required')
    asset=specification['assetId']; version=specification['version']
    require(asset.startswith('classic-') and asset in profile['assets'],'Unknown static Classic asset')
    require(decision['assetId']==asset and decision['version']==version,'Decision identity differs')
    require(bool(decision.get('ownerStatement')) and decision['specificationSha256']==specification['_sha256'],'Decision must bind exact reviewed specification')
    require(bool(specification.get('reviews')) and all(output in specification['files'] for output in specification['outputs']),'Reviewed resources and every declared output must be present')
    utc_timestamp(decision['recordedAtUtc'])
    configured=profile['assets'][asset]
    require(configured.get('route')=='faithful-export','Manual branding requires faithful-export route')
    support=configured.get('manualPromotionSupport',{})
    require(support.get('script')=='scripts/promote-manual-brand.py' and support.get('specificationSha256')==specification['_sha256'],'Distinct-layer support is not configured for this exact specification')
    require(configured.get('manualSources')==specification['layerSources'],'Configured layer sources differ')
    require(configured.get('exports')==specification['outputs'],'Configured reviewed outputs differ')
    contract=configured.get('requiredOutputContract',{})
    if contract.get('nativeVector'):
        require(contract.get('sizeDp')==[24,24] and len(specification['outputs'])==1,'Native notification vector contract differs')
        output=specification['outputs'][0]
        require(output['role'] in ('notification','vector') and output['format']=='AndroidVector' and output['width']==output['height']==24,'Native vector output contract differs')
    elif contract.get('layers'):
        wanted={(role,n) for role in contract['layers'] for n in contract['androidPx']}
        actual={(output['role'],output['width']) for output in specification['outputs']}
        require(actual==wanted and len(actual)==len(specification['outputs']),'Declared outputs do not fulfill the separate-layer density contract')
    elif contract.get('androidPx'):
        if contract.get('configurationPx'):
            roles=('legacy','legacy-round') if asset=='classic-legacy-launcher' else None
            wanted={('configuration',contract['configurationPx'])}|({(role,n) for role in roles for n in contract['androidPx']} if roles else {('native-'+str(n),n) for n in contract['androidPx']})
            actual={(output['role'],output['width']) for output in specification['outputs']}
            require(actual==wanted and len(actual)==len(specification['outputs']),'Declared outputs do not fulfill splash configuration/density contract')
        else:
            actual=[output['width'] for output in specification['outputs']]
            require(sorted(actual)==sorted(contract['androidPx']),'Declared outputs do not fulfill density contract')
    elif contract.get('configurationPx'):
        require(len(specification['outputs'])==1 and specification['outputs'][0]['width']==specification['outputs'][0]['height']==contract['configurationPx'],'Declared output does not fulfill configuration contract')
    registry_path=confined(root,specification['registryPath'],profile['allowedOutputRoots'])
    registry=load_json(registry_path)
    require(sha(registry_path)==specification['expectedRegistrySha256'],'Registry changed before promotion')
    entries=registry['exports']; current=next(e for e in entries if e['id']==asset)
    previous_version=current.get('activeVersion',1) if current.get('approval') else 0
    require(isinstance(version,int) and not isinstance(version,bool) and version>0 and (version==previous_version+1 if previous_version else version in (1,2)),'Manual candidate version is not the next reviewed revision')
    if specification.get('centeringRevision'):
        require(specification['centeringRevision']==2 and specification['sourceAnchorPx']==[233,243],'Revised Classic centering anchor differs')
        require(bool(decision.get('ownerQuestion')) and bool(decision.get('ownerDecisionReference')),'Revised individual decision must retain question and human response reference')
        for previous,required_version in specification.get('requiredAssetVersions',{}).items():
            entry=next(e for e in entries if e['id']==previous)
            require(entry.get('activeVersion')==required_version and entry.get('centeringRevision')==2 and entry.get('approval'),'Earlier centered Classic revision is not approved')
    queue=profile['policies']['queue']; before=queue[:queue.index(asset)]
    scenes=load_json(confined(root,'docs/design/production-assets/manifest.json'))['scenes']
    approved={e['id'] for e in [*entries,*scenes] if e.get('approval')}
    require(all(a in approved for a in before),'Sequential queue anchor is not approved')
    items=[]; destinations=set()
    for item in specification['files']:
        source=confined(root,item['localArtifactPath'])
        destination=confined(root,item['path'],profile['allowedOutputRoots'])
        require(destination.is_relative_to(root/'assets/brand/classic'),'Manual branding cannot write runtime/native resources')
        require(str(destination) not in destinations,'Duplicate publication destination'); destinations.add(str(destination))
        require(source.is_file() and sha(source)==item['sha256'],'Reviewed source/output bytes changed')
        vector=item.get('format')=='AndroidVector'
        require(not vector or asset=='classic-notification' and source.suffix==destination.suffix=='.xml','Native vector belongs to notification XML only')
        facts=inspect_vector(source) if vector else inspect_image(source)
        for key in ['width','height','opaque']+([] if vector else ['mode']):
            require(facts[key]==item[key],f'Actual {key} differs for {item["path"]}')
        require(facts['format'].upper()==item['format'].upper() and item['format'] in ('PNG','WebP','AndroidVector'),'Manual candidate must preserve declared native format')
        if item['format']=='WebP':
            data=source.read_bytes();position=12;lossless=False
            while position+8<=len(data):
                chunk=data[position:position+4];length=int.from_bytes(data[position+4:position+8],'little')
                if chunk==b'VP8L':lossless=True
                position+=8+length+(length%2)
            require(item.get('lossless') is True and lossless,'Manual WebP branding must be actually lossless')
        role=item.get('role','')
        if role in ('foreground','background','monochrome') or asset=='classic-splash' and (role=='configuration' or role.startswith('native-')):
            require(facts['iccValid'] is True and 'srgb' in facts['iccDescription'].lower().replace(' ',''),'Manual layer export requires an actual valid sRGB profile')
            require(facts['opaque']==(item['role']=='background'),'Foreground must be transparent and background opaque')
            if item['role']=='monochrome':
                with Image.open(source) as layer:
                    require(all(r==g==b==255 for r,g,b,a in layer.convert('RGBA').get_flattened_data() if a>0),'Monochrome alpha shape must be white')
            if item['role'] in ('foreground','monochrome'):
                with Image.open(source) as layer:
                    alpha=layer.convert('RGBA').getchannel('A');n=layer.width
                    max_radius=max(((i%n+.5-n/2)**2+(i//n+.5-n/2)**2)**.5/(n/108)
                                   for i,a in enumerate(alpha.tobytes()) if a>0)
                require(max_radius<33,'Actual adaptive foreground exceeds central66dp safe circle')
            elif asset=='classic-splash':
                with Image.open(source) as layer:
                    alpha=layer.convert('RGBA').getchannel('A');n=layer.width
                    require(alpha.getextrema()[0]==0,'Splash isolation requires actual transparent padding')
                    max_radius=max(((i%n+.5-n/2)**2+(i//n+.5-n/2)**2)**.5/(n/288)
                                   for i,a in enumerate(alpha.tobytes()) if a>0)
                require(max_radius<96,'Actual splash isolation exceeds central192px safe circle')
        if item.get('manualExportSpec'):
            transform=item['manualExportSpec']
            if specification.get('centeringRevision'):
                if transform['kind']=='uniform-affine':require(transform['sourceCenterPx']==[233,243],'Layer transform does not center the main ring')
                elif transform['kind']=='crop-resize':require(transform['sourceRectPx']==[9,19,457,467],'Legacy crop does not center the main ring')
            if transform.get('allowUpscale') is True:require(asset=='classic-legacy-launcher' and item['role']=='configuration' and item['width']==item['height']==1024,'Only explicitly reviewed legacy configuration may enlarge source')
            parent=next(s for s in specification['layerSources'] if s['role']==item['sourceRole'])
            prepared_source=confined(root,parent['localArtifactPath'])
            require(sha(prepared_source)==parent['sha256'],'Declared layer source changed')
            expected=manual_pixels(prepared_source,item['manualExportSpec'])
            with Image.open(source) as decoded: require(pixels_equal(expected,decoded),'Prepared output differs from its distinct source transform')
        items.append((source,destination,{k:v for k,v in item.items() if k!='localArtifactPath'}))
    for reference in specification['references']:
        require(sha(confined(root,reference['path']))==reference['sha256'],'Original reference changed')
    for review in specification['reviews']:
        require(sha(confined(root,review['localArtifactPath']))==review['sha256'],'Presented review changed')
    return registry_path,registry,current,items

def promote(root,profile,specification,decision):
    registry_path,registry,current,items=validate(root,profile,specification,decision)
    asset=specification['assetId']; version=specification['version']
    metadata=confined(root,profile['metadataRoot'],profile['allowedOutputRoots'])
    journal_path=metadata/'records'/asset/f'manual-transaction-v{version}.json'
    approval_path=metadata/'approvals'/f'{asset}-v{version}.json'
    record_path=metadata/'records'/asset/f'candidate-{specification["candidate"]:02}.json'
    lock=confined(root,profile['localRoot'],profile['allowedOutputRoots'])/'.manual-brand-promotion.lock'
    lock.parent.mkdir(parents=True,exist_ok=True)
    with lock.open('x',encoding='utf-8') as stream: stream.write(asset+'\n')
    try:
        require(not journal_path.exists() and not approval_path.exists() and not record_path.exists(),'Manual promotion already exists; inspect its journal instead of overwriting')
        require(all(not target.exists() for _,target,_ in items),'Refusing to overwrite production files')
        production=[f for _,_,f in items if f.get('role') in ('foreground','background','monochrome','configuration','legacy','legacy-round','notification','splash','native','favicon') or f.get('role','').startswith('native-')]
        sources=[f for _,_,f in items if f.get('role','').startswith('source')]
        record={k:v for k,v in specification.items() if not k.startswith('_')}
        record.update({'recordedAtUtc':now(),'approval':None,'productionFiles':None})
        atomic_json(record_path,record)
        files=[f for _,_,f in items]
        approval={'schemaVersion':1,'assetId':asset,'version':version,'candidate':specification['candidate'],
                  'ownerStatement':decision['ownerStatement'],'recordedAtUtc':decision['recordedAtUtc'],
                  'activationApproved':True,
                  'scope':decision['scope'],'sources':specification['references'],'review':specification['reviews'][0],
                  'reviews':specification['reviews'],'files':files,
                  'preparedRecord':{'path':relative(root,record_path),'sha256':sha(record_path)},
                  'manualLayerSources':sources,'technicalLimitations':specification['technicalLimitations'],
                  'checks':{'candidateBytesPreserved':True,'distinctLayerTransformsVerified':bool(production) and all(f.get('manualExportSpec') for f in production),
                            'nativeVectorStructureVerified':any(f['format']=='AndroidVector' for f in production),
                            'allOutputDimensionsMatch':True,'installedDeviceAppearanceAssessed':False}}
        if specification.get('centeringRevision'):
            approval.update({'centeringRevision':2,'sourceAnchorPx':specification['sourceAnchorPx'],
                             'ownerQuestion':decision['ownerQuestion'],'ownerDecisionReference':decision['ownerDecisionReference']})
        approval_bytes=(json.dumps(approval,indent=2,ensure_ascii=False)+'\n').encode('utf-8')
        approval_ref={'path':relative(root,approval_path),'sha256':hashlib.sha256(approval_bytes).hexdigest(),
                      'ownerStatement':decision['ownerStatement'],'recordedAtUtc':decision['recordedAtUtc'],
                      'activationApproved':True,
                      'candidate':specification['candidate'],'files':files}
        new_registry=copy.deepcopy(registry)
        updated=next(e for e in new_registry['exports'] if e['id']==asset)
        if current.get('approval'):
            historical=copy.deepcopy(current);historical.pop('approvedVersionHistory',None);historical.pop('history',None)
            updated.setdefault('approvedVersionHistory',[]).append(historical)
        updated.update({'candidateRecords':[*current.get('candidateRecords',[]),relative(metadata,record_path)],'reviewCandidate':specification['candidate'],
                        'activeVersion':version,'approval':approval_ref,'approvedSource':next(f for f in sources if f['role']=='source'),
                        'approvedSources':[f for f in sources if f['role']!='source'],'productionFiles':production,
                        'technicalLimitations':specification['technicalLimitations'],
                        'manualPromotionSupport':profile['assets'][asset]['manualPromotionSupport']})
        if specification.get('centeringRevision'):updated.update({'centeringRevision':2,'sourceAnchorPx':specification['sourceAnchorPx']})
        journal={'schemaVersion':1,'assetId':asset,'version':version,'state':'prepared',
                 'expectedRegistrySha256':sha(registry_path),'specificationSha256':specification['_sha256'],
                 'decision':decision,'files':files,'approvalSha256':approval_ref['sha256']}
        atomic_json(journal_path,journal)
        for source,target,facts in items:
            target.parent.mkdir(parents=True,exist_ok=True)
            temporary=target.with_name(target.name+'.manual-promotion.part')
            require(temporary.is_relative_to(root/'assets/brand/classic'),'Staging path escaped brand tree')
            with source.open('rb') as incoming,temporary.open('xb') as outgoing:
                shutil.copyfileobj(incoming,outgoing);outgoing.flush();os.fsync(outgoing.fileno())
            require(sha(temporary)==facts['sha256'],'Staged bytes differ')
            if os.name=='nt': os.rename(temporary,target)
            else:
                os.link(temporary,target);temporary.unlink()
            require(sha(target)==facts['sha256'],'Published bytes differ')
        atomic_json(approval_path,approval)
        journal['state']='files-written';atomic_json(journal_path,journal,replace=True)
        require(sha(registry_path)==specification['expectedRegistrySha256'],'Registry changed during publication')
        atomic_json(registry_path,new_registry,replace=True)
        journal['state']='committed';atomic_json(journal_path,journal,replace=True)
        return {'assetId':asset,'version':version,'approval':approval_ref,'productionFiles':production,
                'runtimeResourcesWritten':False,'deviceAcceptanceAssessed':False}
    finally: lock.unlink(missing_ok=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation',choices=['check','promote'])
    for name in ['project-root','profile','specification','decision']: parser.add_argument('--'+name,required=True)
    args=parser.parse_args();root=Path(args.project_root).resolve()
    profile=load_json(confined(root,args.profile));path=confined(root,args.specification)
    specification=load_json(path);specification['_sha256']=sha(path)
    decision=load_json(confined(root,args.decision))
    if args.operation=='check':
        _,_,_,items=validate(root,profile,specification,decision)
        result={'assetId':specification['assetId'],'filesVerified':len(items),'productionFilesWritten':False}
    else: result=promote(root,profile,specification,decision)
    print(json.dumps(result,indent=2))

if __name__=='__main__':
    try: main()
    except (ValueError,OSError,KeyError) as error:
        print(json.dumps({'error':str(error)}),file=sys.stderr);sys.exit(1)
