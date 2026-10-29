"""Faithful Classic export geometry and staged-file checks, without approval history."""
import importlib.util, json, os, sys, tempfile, unittest
from argparse import Namespace
from pathlib import Path
from PIL import Image, ImageDraw
MODULE=Path(__file__).resolve().parents[1]/'export-brand.py'
spec=importlib.util.spec_from_file_location('export_brand_test',MODULE)
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
import asset_common as common
import asset_workflow as workflow

class BrandExportTests(unittest.TestCase):
    def setUp(self):
        parent=MODULE.parent.parent/'verification/local';parent.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(prefix='brand-export-',dir=parent);self.root=Path(self.temp.name)
        (self.root/'assets').mkdir();self.source=self.root/'assets/layer.png'
        image=Image.new('RGBA',(467,467),(0,0,0,0));ImageDraw.Draw(image).rectangle((80,90,386,396),fill='white');image.save(self.source)
    def tearDown(self):self.temp.cleanup()
    def splash(self,size):return {'kind':'splash-density-affine','size':[size,size],'sourceCenterPx':[233,243],'dpPerSourcePx':.3777480127985562,'layerSizeDp':288,'interpolationPolicy':'preserve-current-splash-size'}
    def test_splash_density_affine_preserves_logical_size_with_bounded_interpolation(self):
        bounds=[]
        for n in (288,432,576,864,1152):
            image=helper.manual_pixels(self.source,self.splash(n));box=image.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox();bounds.append(tuple(v/(n/288) for v in box))
            self.assertEqual(image.size,(n,n));self.assertEqual(image.getpixel((0,0))[3],0)
        for box in bounds[1:]:
            for actual,expected in zip(box,bounds[0]):self.assertLess(abs(actual-expected),1.1)
    def test_splash_interpolation_rejects_changed_geometry_or_implicit_permission(self):
        for patch in ({'size':[1440,1440]},{'sourceCenterPx':[233,242]},{'dpPerSourcePx':.4},{'layerSizeDp':240},{'interpolationPolicy':None}):
            with self.assertRaisesRegex(ValueError,'geometry|disclosed'):helper.manual_pixels(self.source,{**self.splash(1152),**patch})
    def test_ordinary_affine_and_crop_reject_unpermitted_upscale(self):
        with self.assertRaisesRegex(ValueError,'must not enlarge'):helper.manual_pixels(self.source,{**self.splash(1152),'kind':'uniform-affine'})
        with self.assertRaisesRegex(ValueError,'enlarge'):helper.manual_pixels(self.source,{'kind':'crop-resize','size':[1024,1024],'sourceRectPx':[9,19,457,467]})
    def test_splash_recipe_cannot_be_used_for_another_brand_asset(self):
        output={'source':'foreground','transform':self.splash(288),'width':288,'height':288,'format':'PNG'}
        with self.assertRaisesRegex(ValueError,'only valid for the splash'):helper.brand_output(self.root,'classic-adaptive',output,{'foreground':self.source},self.root/'wrong.png')
    def test_native_vector_requires_white_24dp_geometry_without_entities(self):
        path=self.root/'vector.xml';good='<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFF" android:pathData="M2,2 L22,2 L12,22 Z" /></vector>'
        path.write_text(good);self.assertEqual(helper.inspect_vector(path)['pathCount'],1)
        for bad in [good.replace('#FFFFFF','#FF123456'),good.replace('24dp','25dp'),'<!DOCTYPE vector>'+good,good.replace('M2,2 L22,2 L12,22 Z','invalid')]:
            path.write_text(bad)
            with self.assertRaises(ValueError):helper.inspect_vector(path)
    def test_brand_staging_reuses_current_transform_without_mutating_active_files(self):
        output=self.root/'assets/current.png';recipe={'kind':'uniform-affine','sourceCenterPx':[233,243],'dpPerSourcePx':.13221180447949465,'layerSizeDp':108}
        image=helper.manual_pixels(self.source,{**recipe,'size':[108,108]});common.encode_image(image,output,'PNG')
        asset={'sources':{'foreground':{'path':'assets/layer.png',**workflow.measured(self.source)}},'outputs':{'foreground':{'path':'assets/current.png',**workflow.measured(output),'source':'foreground','transform':recipe,'copies':[]}}}
        manifest=self.root/'assets/manifest.json';common.atomic_json(manifest,{'schemaVersion':2,'assets':{'classic-adaptive':asset}})
        profile={'schemaVersion':2,'localRoot':'verification/local/artwork','allowedOutputRoots':['verification/local/artwork','assets'],'manifests':{'brand':'assets/manifest.json'}}
        before={p:common.sha(p) for p in [self.source,output,manifest]}
        result=workflow.stage_asset(self.root,profile,Namespace(asset='classic-adaptive',run='layer-export',manifest='brand',spec=None,source=None),helper.brand_output,'brand')
        self.assertEqual(helper.check_staged(self.root,profile,Namespace(record=result['record']))['filesVerified'],2)
        self.assertEqual({p:common.sha(p) for p in before},before)
        record=common.load_json(self.root/result['record']);target=next(e for e in record['files'] if e['destination']=='assets/current.png')
        path=self.root/target['path'];Image.new('RGBA',(108,108),'red').save(path);target['sha256']=common.sha(path);record['asset']['outputs']['foreground']['sha256']=target['sha256'];common.atomic_json(self.root/result['record'],record,replace=True)
        with self.assertRaisesRegex(ValueError,'pixels differ'):helper.check_staged(self.root,profile,Namespace(record=result['record']))

if __name__=='__main__':unittest.main()
