"""Stage faithful Classic exports using the existing pixel transformations."""
from __future__ import annotations
import argparse, io, json, shutil, sys, re, xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image, ImageDraw
REPOSITORY=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(REPOSITORY/'.agents/skills/prepare-visual-assets/scripts'))
from asset_common import confined, encode_image, load_json, pixels_equal, require
from asset_workflow import stage_asset, verify_prepared, profile_roots, local_file

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
    splash_density=specification['kind']=='splash-density-affine'
    require(specification['kind']=='uniform-affine' or splash_density,'Unknown manual export transformation')
    require(target[0]==target[1] and im.mode=='RGBA','Uniform affine requires a square transparent layer')
    center=specification['sourceCenterPx']
    require(len(center)==2 and all(isinstance(v,(int,float)) and __import__('math').isfinite(v) for v in center),'Invalid affine center')
    k=specification['dpPerSourcePx']*target[0]/specification['layerSizeDp']
    if splash_density:
        # A renderer-sized canvas preserves the approved 288dp composition.
        # Only this exact Classic source transform may interpolate its finite
        # source detail at xxhdpi/xxxhdpi; ordinary exports still cannot enlarge.
        require(im.size==(467,467) and center==[233,243]
                and specification['dpPerSourcePx']==0.3777480127985562
                and specification['layerSizeDp']==288
                and target[0] in (288,432,576,864,1152),
                'Splash density transform differs from the reviewed source geometry')
        require(specification.get('interpolationPolicy')=='preserve-current-splash-size',
                'Splash source interpolation must be explicitly disclosed')
        require(0<k<=1.5109920511942248,'Splash interpolation exceeds the declared density bound')
    else:
        require(0<k<=1,'Uniform affine must not enlarge source detail')
    coefficients=(1/k,0,center[0]-target[0]/2/k,0,1/k,center[1]-target[1]/2/k)
    return im.transform(target,Image.Transform.AFFINE,coefficients,resample=Image.Resampling.BICUBIC)


def brand_output(root, asset, output, sources, destination):
    source=sources[output['source']]
    if output['transform']['kind']=='copy':
        if output['format']=='ANDROIDVECTOR':inspect_vector(source)
        shutil.copyfile(source,destination)
    else:
        recipe={**output['transform'],'size':[output['width'],output['height']]}
        if recipe['kind']=='splash-density-affine':require(asset=='classic-splash','Splash interpolation is only valid for the splash asset')
        image=manual_pixels(source,recipe)
        encode_image(image,destination,output['format'])

def check_staged(root,profile,args):
    record=verify_prepared(root,profile,args.record)
    files={entry['destination']:local_file(root,profile,entry['path']) for entry in record['files']}
    sources={role:files[entry['path']] for role,entry in record['asset']['sources'].items()}
    for output in record['asset']['outputs'].values():
        target=files[output['path']]
        if output['transform']['kind']=='copy':
            require(target.read_bytes()==sources[output['source']].read_bytes(),'Copied vector differs')
            if output['format']=='ANDROIDVECTOR':inspect_vector(target)
        else:
            expected=manual_pixels(sources[output['source']],{**output['transform'],'size':[output['width'],output['height']]})
            with Image.open(target) as actual:require(pixels_equal(expected,actual),'Staged pixels differ from the configured transformation')
    return {'assetId':record['assetId'],'filesVerified':len(files),'productionFilesWritten':False}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='operation',required=True)
    for op in ('prepare','check-staged'):
        command=sub.add_parser(op)
        command.add_argument('--project-root',required=True);command.add_argument('--profile',required=True)
        if op=='prepare':
            for name in ('manifest','asset','run'):command.add_argument('--'+name,required=True)
            command.add_argument('--spec');command.add_argument('--source');command.add_argument('--source-role',default='master')
        else:command.add_argument('--record',required=True)
    args=parser.parse_args();root=Path(args.project_root).resolve();profile=load_json(confined(root,args.profile));profile_roots(root,profile)
    result=stage_asset(root,profile,args,brand_output,'brand') if args.operation=='prepare' else check_staged(root,profile,args)
    print(json.dumps(result,indent=2))
if __name__=='__main__':
    try:main()
    except (ValueError,OSError,KeyError) as error:print(json.dumps({'error':str(error)}));sys.exit(1)
