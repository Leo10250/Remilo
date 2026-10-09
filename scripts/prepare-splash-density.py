"""Stage renderer-sized Classic splash derivatives for individual review only.

No registry, active resource, configuration, approval or backlog is changed.
Every density is rendered from the approved 467px isolation, never an export.
"""
from __future__ import annotations
import argparse, copy, importlib.util, json, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[1]
module_spec = importlib.util.spec_from_file_location('manual_brand', ROOT/'scripts/promote-manual-brand.py')
manual = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(manual)

SOURCE = 'assets/brand/classic/masters/classic-splash-isolated-v2.png'
SOURCE_SHA = '460699483bf61755b5bd698f22ee3ed34c35e9099b24c117e3b156318ae4dfc0'
DENSITIES = [('mdpi',1,288),('hdpi',1.5,432),('xhdpi',2,576),('xxhdpi',3,864),('xxxhdpi',4,1152)]
LAYOUT = {'canvasDp':288,'imageWidthDp':288,'nativeCanvasPx':[288,432,576,864,1152]}
SCALE = 0.3777480127985562


def save_image(image, path, icc):
    path.parent.mkdir(parents=True, exist_ok=True)
    manual.require(not path.exists(), 'Refusing to overwrite a reviewed candidate image')
    image.save(path, format='PNG', icc_profile=icc)


def font(size):
    try:
        return ImageFont.truetype('C:/Windows/Fonts/arial.ttf', size)
    except OSError:
        return ImageFont.load_default()


def surface(image, background):
    result = Image.new('RGBA', image.size, background)
    result.alpha_composite(image)
    return result.convert('RGB')


def measured(path):
    facts = manual.inspect_image(path)
    with Image.open(path) as image:
        alpha = image.convert('RGBA').getchannel('A')
        facts['alpha50BoundsPx'] = list(alpha.point(lambda a:255 if a >= 128 else 0).getbbox())
        n = image.width
        facts['maximumVisibleRadiusDp'] = max(
            ((i % n + .5 - n/2)**2 + (i // n + .5 - n/2)**2)**.5 / (n/288)
            for i, a in enumerate(alpha.tobytes()) if a > 0)
    return facts


def stage(root, profile_path):
    profile = manual.load_json(profile_path)
    allowed = profile['allowedOutputRoots']
    local = manual.confined(root, profile['localRoot'], allowed)/'classic-splash-density'/'candidate-v3'
    metadata = manual.confined(root, profile['metadataRoot'], allowed)
    spec_path = metadata/'records/classic-splash/manual-specification-v3.json'
    candidate_profile_path = metadata/'records/classic-splash/profile-candidate-v3.json'
    review_profile_path = metadata/'records/classic-splash/profile-review-v3.json'
    brief_path = metadata/'prompts/classic-splash/density-v3-preparation.txt'
    refs_path = metadata/'records/classic-splash/density-v3-inputs.json'
    prepared_path = metadata/'records/classic-splash/density-v3-prepared.json'
    manual.require(not local.exists() and all(not p.exists() for p in
        [spec_path,candidate_profile_path,review_profile_path,brief_path,refs_path,prepared_path]),
        'Splash v3 candidate already exists; do not overwrite review evidence')
    source = manual.confined(root, SOURCE)
    manual.require(manual.sha(source) == SOURCE_SHA, 'Approved isolated Classic source differs')
    source_facts = manual.inspect_image(source)
    manual.require(source_facts['size'] == [467,467] and source_facts['mode'] == 'RGBA'
        and source_facts['iccValid'] and 'srgb' in source_facts['iccDescription'].lower().replace(' ',''),
        'Splash source requires the approved 467px transparent sRGB isolation')
    registry_path = manual.confined(root, 'docs/design/production-assets/brand-manifest.json')
    registry = manual.load_json(registry_path)
    active = next(e for e in registry['exports'] if e['id'] == 'classic-splash')
    manual.require(active.get('activeVersion') == 2 and active.get('centeringRevision') == 2
        and active.get('sourceAnchorPx') == [233,243] and active.get('approval'),
        'Splash v3 must retain the approved v2 centering anchor')
    local.mkdir(parents=True)
    source_copy = local/'isolated-source-467.png'
    reference_copy = local/'classic-reference-467.png'
    shutil.copyfile(source, source_copy)
    reference = manual.confined(root, 'assets/brand/reference/icon-classic.png')
    shutil.copyfile(reference, reference_copy)
    with Image.open(source) as decoded:
        icc = decoded.info['icc_profile']
    outputs, measurements, images = [], [], {}
    for role, density, n in [('configuration',1,288), *[(f'native-{n}',d,n) for _,d,n in DENSITIES]]:
        transform = {'kind':'uniform-affine' if role == 'configuration' else 'splash-density-affine',
            'sourceCenterPx':[233,243],'dpPerSourcePx':SCALE,'layerSizeDp':288,'size':[n,n]}
        if role != 'configuration':
            transform['interpolationPolicy'] = 'preserve-current-splash-size'
        image = manual.manual_pixels(source, transform)
        candidate = local/'exports'/f'{role}-{n}.png'
        save_image(image, candidate, icc)
        facts = measured(candidate)
        manual.require(facts['maximumVisibleRadiusDp'] < 96, 'Splash artwork exceeds the 192dp safe circle')
        name = 'classic-splash-v3.png' if role == 'configuration' else f'classic-splash-{n}-v3.png'
        item = {'role':role,'localArtifactPath':manual.relative(root,candidate),
            'path':f'assets/brand/classic/splash/{name}','sha256':manual.sha(candidate),
            'width':n,'height':n,'format':'PNG','mode':'RGBA','opaque':False,
            'candidateBytesPreserved':True,'sourceRole':'foreground',
            'derivedFrom':{'path':'assets/brand/classic/masters/classic-splash-isolated-v3.png','sha256':SOURCE_SHA},
            'manualExportSpec':transform,'resizedFromPx':[467,467],
            'upscaled':SCALE*density > 1,'sourcePixelScale':SCALE*density,'lossless':True}
        if role != 'configuration':
            item['density'] = next(name for name,d,s in DENSITIES if s == n)
        outputs.append(item)
        box = facts['alpha50BoundsPx']
        measurements.append({'role':role,'densityMultiplier':density,**facts,
            'alpha50FootprintDp':[(box[2]-box[0])/density,(box[3]-box[1])/density]})
        images[role] = image
    limitations = [
        'Every native density renders directly from the unchanged 467px approved isolated source; no intermediate configuration image is resized.',
        'The 288dp composition retains the current visible mark, approximately 131 by 139dp at 50-percent alpha.',
        'xxhdpi source pixels interpolate at 1.1332440383956686x and xxxhdpi at 1.5109920511942248x; interpolation adds no original detail.',
        'The approved isolation retains its original matte/finish limitations.',
        'Synthetic scaling, backgrounds and usage previews are not Android screenshots, device acceptance or accessibility evidence.',
        'Actual-pixel artwork and activation approval remain pending; no active resources or configuration are changed.'
    ]
    preview_paths = []
    # Compare at the same physical size; the old resource scaling is an explicit
    # simulation, not claimed Android renderer evidence.
    old_path = manual.confined(root, 'android/app/src/main/res/drawable-xhdpi/splashscreen_logo.png')
    with Image.open(old_path) as old:
        previous = old.convert('RGBA').resize((576,576), Image.Resampling.BILINEAR)
    sheet = Image.new('RGB',(1200,710),'#eef0f4');draw = ImageDraw.Draw(sheet)
    draw.text((20,14),'Classic splash v3: same visible size, correct density canvas',fill='#17202f',font=font(24))
    draw.text((20,52),'Existing 152px resource scaled to 576px (simulation)',fill='#17202f',font=font(17))
    draw.text((618,52),'Candidate: original 467px source rendered directly at 576px',fill='#17202f',font=font(17))
    sheet.paste(surface(previous,'#F7F8FA'),(12,85));sheet.paste(surface(images['native-576'],'#F7F8FA'),(612,85))
    draw.text((20,675),'Synthetic comparison; both display the mark at approximately 131 x 139dp.',fill='#344055',font=font(18))
    comparison_path = local/'review/same-size-xhdpi.png';save_image(sheet,comparison_path,icc);preview_paths.append(comparison_path)
    # 360x800 logical placements on the actual light background plus diagnostic
    # dark surface; static identity and current light launch background remain.
    usage = Image.new('RGB',(760,884),'#eef0f4');draw = ImageDraw.Draw(usage)
    draw.text((20,10),'Synthetic 360 x 800dp splash placements',fill='#17202f',font=font(23))
    for x,bg,label in [(10,'#F7F8FA','Current #F7F8FA background'),(390,'#18212f','Dark diagnostic only')]:
        screen = Image.new('RGB',(360,800),bg)
        mark = surface(images['configuration'],bg)
        screen.paste(mark,(36,256));usage.paste(screen,(x,48))
        draw.text((x,856),label,fill='#17202f',font=font(17))
    usage_path = local/'review/usage-360dp.png';save_image(usage,usage_path,icc);preview_paths.append(usage_path)
    # Actual 4x-density source/export pixels and alpha on checkerboard.
    n = 1152; old4_path = manual.confined(root,'android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png')
    with Image.open(old4_path) as old:
        old4 = old.convert('RGBA').resize((n,n),Image.Resampling.BILINEAR)
    crop = (320,276,844,836)
    detail = Image.new('RGB',(1080,662),'#eef0f4');draw = ImageDraw.Draw(detail)
    draw.text((14,10),'xxxhdpi detail: decoded pixels at 1:1 (not magnified)',fill='#17202f',font=font(23))
    for x,img,label in [(14,old4,'Existing 304px resource scaled to 1152px'),(552,images['native-1152'],'Direct source render; 1.511x source interpolation')]:
        draw.text((x,48),label,fill='#17202f',font=font(16))
        detail.paste(surface(img,'#F7F8FA').crop(crop),(x,80))
    detail_path = local/'review/xxxhdpi-detail.png';save_image(detail,detail_path,icc);preview_paths.append(detail_path)
    brief = ('Asset/use: Classic Android splash, renderer-sized density resources.\n'
        'Route: faithful-export; deterministic preparation only; no ImageGen.\n'
        f'Input: {SOURCE}; SHA-256 {SOURCE_SHA}; unchanged approved 467px RGBA isolation.\n'
        'Keep: ring/check/sun proportions, finish and source-ring anchor [233,243].\n'
        f'Transform: 288dp transparent canvas; uniform scale {SCALE} dp/source-pixel; BICUBIC affine.\n'
        'Output: configuration288; native288/432/576/864/1152px, all rendered from original source.\n'
        'Retain the current approximately131x139dp visible mark; set imageWidth288 only after activation approval.\n'
        'Disclose: xxhdpi/xxxhdpi original-source interpolation at1.133x/1.511x adds no detail.\n'
        'Exclude: redraw, feature movement, fresh identity, active resource writes, synthetic owner approval.\n')
    brief_path.parent.mkdir(parents=True,exist_ok=True);brief_path.write_text(brief,encoding='utf-8')
    references = [{'file':SOURCE,'role':'faithful-source','influence':'Preserve the inspected approved isolation, source-ring anchor and finish','inspected':True},
        {'file':'assets/brand/reference/icon-classic.png','role':'historical','influence':'Inspected original identity provenance only; no tile pixels added to isolation','inspected':True}]
    manual.atomic_json(refs_path,references)
    files = []
    for role,path,name in [('source',reference_copy,'classic-splash-v3.png'),('source-foreground',source_copy,'classic-splash-isolated-v3.png')]:
        facts = manual.inspect_image(path)
        files.append({'role':role,'localArtifactPath':manual.relative(root,path),
            'path':f'assets/brand/classic/masters/{name}','sha256':manual.sha(path),
            'width':467,'height':467,'format':'PNG','mode':facts['mode'],'opaque':facts['opaque'],'candidateBytesPreserved':True})
    specification = {'schemaVersion':1,'assetId':'classic-splash','version':3,'candidate':3,
        'registryPath':manual.relative(root,registry_path),'expectedRegistrySha256':manual.sha(registry_path),
        'centeringRevision':2,'sourceAnchorPx':[233,243],'splashLayout':LAYOUT,
        'requiredAssetVersions':{'classic-adaptive':2},'method':brief,
        'sources':files,'references':[{ 'path':p,'sha256':manual.sha(manual.confined(root,p))}
            for p in ['assets/brand/reference/icon-classic.png','assets/brand/reference/source-icon-board.png']],
        'layerSources':[{'role':'foreground','localArtifactPath':SOURCE,'sha256':SOURCE_SHA,
            'productionPath':'assets/brand/classic/masters/classic-splash-isolated-v3.png'}],
        'outputs':outputs,'files':files+outputs,
        'reviews':[{'localArtifactPath':manual.relative(root,p),'sha256':manual.sha(p)} for p in preview_paths],
        'technicalLimitations':limitations,
        'staticConfiguration':{'splashBackground':'#F7F8FA','nativeImageWidthDp':288}}
    manual.atomic_json(spec_path,specification)
    candidate_profile = copy.deepcopy(profile)
    configured = candidate_profile['assets']['classic-splash']
    configured.update({'exports':outputs,'manualSources':specification['layerSources'],
        'requiredOutputContract':{'configurationPx':288,'androidPx':LAYOUT['nativeCanvasPx']},
        'manualPromotionSupport':{'script':'scripts/promote-manual-brand.py',
            'specification':manual.relative(root,spec_path),'specificationSha256':manual.sha(spec_path),
            'sourcePolicy':'Original approved 467px isolation; bounded density interpolation preserves the current visible splash size.'}})
    manual.atomic_json(candidate_profile_path,candidate_profile)
    review_profile = copy.deepcopy(profile)
    review_profile['assets']['classic-splash'].update({'helperUnsupported':False,'exports':[],'views':[],
        'sourceSha256':SOURCE_SHA,'master':{'destination':'assets/brand/classic/masters/{asset}-v{version}{suffix}',
            'format':'PNG','alpha':'transparent','colorSpace':'srgb','exactSize':[467,467]},
        'reviewPurpose':'Source preservation and inspection only. Separate manual specification governs density exports; this profile cannot promote them.'})
    manual.atomic_json(review_profile_path,review_profile)
    record = {'schemaVersion':1,'assetId':'classic-splash','candidate':3,'version':3,'recordedAtUtc':manual.now(),
        'generator':'deterministic-export','promptKind':'preparation','pillowVersion':pillow_version,
        'source':{'path':SOURCE,**source_facts},'originalProfile':{'projectRelativeIdentifier':manual.relative(root,profile_path),'sha256':manual.sha(profile_path)},
        'preparationBrief':{'path':manual.relative(root,brief_path),'sha256':manual.sha(brief_path)},
        'manualSpecification':{'path':manual.relative(root,spec_path),'sha256':manual.sha(spec_path)},
        'candidateProfile':{'path':manual.relative(root,candidate_profile_path),'sha256':manual.sha(candidate_profile_path)},
        'measurements':measurements,'previewPanels':specification['reviews'],'visualInspection':{'status':'pending'},
        'approval':None,'productionFilesWritten':False,'runtimeAcceptance':'pending','technicalLimitations':limitations}
    manual.atomic_json(prepared_path,record)
    return {'record':manual.relative(root,prepared_path),'manualSpecification':manual.relative(root,spec_path),
        'candidateProfile':manual.relative(root,candidate_profile_path),'reviewProfile':manual.relative(root,review_profile_path),
        'brief':manual.relative(root,brief_path),'references':manual.relative(root,refs_path),
        'previewPanels':record['previewPanels'],'productionFilesWritten':False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project-root',required=True)
    parser.add_argument('--profile',required=True)
    args = parser.parse_args()
    root = Path(args.project_root).resolve()
    manual.require(root == ROOT,'This preparation script belongs to the explicit Remilo project root')
    profile_path = manual.confined(root,args.profile)
    print(json.dumps(stage(root,profile_path),indent=2))


if __name__ == '__main__':
    main()
