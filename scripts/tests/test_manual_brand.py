"""Bounded manual-brand transaction guard tests with synthetic temporary inputs."""
import importlib.util,json,tempfile,unittest
from pathlib import Path
from PIL import Image,ImageCms

MODULE=Path(__file__).resolve().parents[1]/'promote-manual-brand.py'
TEMP_ROOT=MODULE.parent.parent/'verification/local/manual-brand-tests'
spec=importlib.util.spec_from_file_location('manual_brand_test',MODULE)
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)

class ManualBrandTests(unittest.TestCase):
    def setUp(self):
        TEMP_ROOT.mkdir(parents=True,exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=TEMP_ROOT);self.root=Path(self.temp.name).resolve()
        self.assertTrue(self.root.is_relative_to(TEMP_ROOT.resolve()))
        for directory in ['verification/local/artwork','docs/design/production-assets','assets/brand/classic','assets/brand/reference']:
            (self.root/directory).mkdir(parents=True)
        profile=ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
        primary=self.root/'assets/brand/reference/source.png'
        Image.new('RGB',(467,467),'#fff5ee').save(primary)
        foreground=self.root/'verification/local/artwork/fg.png'
        im=Image.new('RGBA',(467,467),(0,0,0,0))
        from PIL import ImageDraw
        ImageDraw.Draw(im).ellipse((130,130,337,337),fill='#6577e8')
        im.save(foreground,icc_profile=profile)
        background=self.root/'verification/local/artwork/bg.png';Image.new('RGB',(467,467),'#fff5ee').save(background,icc_profile=profile)
        layers=[{'role':role,'localArtifactPath':helper.relative(self.root,path),'sha256':helper.sha(path),'productionPath':f'assets/brand/classic/{role}-source.png'}
                for role,path in [('foreground',foreground),('background',background)]]
        files=[];outputs=[]
        for role,path in [('source',primary),('source-foreground',foreground),('source-background',background)]:
            facts=helper.inspect_image(path)
            files.append({'role':role,'localArtifactPath':helper.relative(self.root,path),'path':f'assets/brand/classic/{role}.png','sha256':helper.sha(path),
                          'width':467,'height':467,'format':'PNG','mode':facts['mode'],'opaque':facts['opaque']})
        for role,path in [('foreground',foreground),('background',background)]:
            transform=({'kind':'uniform-affine','size':[108,108],'sourceCenterPx':[233.5,233.5],'dpPerSourcePx':.15,'layerSizeDp':108}
                       if role=='foreground' else {'kind':'resize','size':[108,108]})
            output=self.root/f'verification/local/artwork/{role}-108.png'
            helper.manual_pixels(path,transform).save(output,icc_profile=profile)
            facts=helper.inspect_image(output)
            outputs.append({'role':role,'localArtifactPath':helper.relative(self.root,output),'path':f'assets/brand/classic/{role}-108.png','sha256':helper.sha(output),
                            'width':108,'height':108,'format':'PNG','mode':facts['mode'],'opaque':facts['opaque'],'sourceRole':role,'manualExportSpec':transform})
        registry=self.root/'docs/design/production-assets/brand-manifest.json'
        registry.write_text(json.dumps({'exports':[{'id':'classic-adaptive','approval':None,'productionFiles':None}]}))
        (registry.parent/'manifest.json').write_text(json.dumps({'scenes':[]}))
        self.data={'schemaVersion':1,'assetId':'classic-adaptive','version':1,'candidate':1,'registryPath':helper.relative(self.root,registry),
                   'expectedRegistrySha256':helper.sha(registry),'layerSources':layers,'outputs':outputs,'files':files+outputs,
                   'references':[{'path':helper.relative(self.root,primary),'sha256':helper.sha(primary)}],
                   'reviews':[{'localArtifactPath':helper.relative(self.root,primary),'sha256':helper.sha(primary)}],
                   'technicalLimitations':[],'_sha256':'bound-specification'}
        self.profile={'localRoot':'verification/local/artwork','metadataRoot':'docs/design/production-assets',
                      'allowedOutputRoots':['verification/local/artwork','docs/design/production-assets','assets/brand/classic'],
                      'policies':{'queue':['classic-adaptive']},'assets':{'classic-adaptive':{
                          'route':'faithful-export','manualSources':layers,'exports':outputs,
                          'requiredOutputContract':{'layers':['foreground','background'],'androidPx':[108]},
                          'manualPromotionSupport':{'script':'scripts/promote-manual-brand.py','specificationSha256':'bound-specification'}}}}
        self.decision={'assetId':'classic-adaptive','version':1,'promote':True,'activationApproved':True,'ownerStatement':'Synthetic test decision',
                       'recordedAtUtc':'2026-10-09T08:00:00+00:00','specificationSha256':'bound-specification','scope':'Synthetic test only'}
    def tearDown(self):
        self.assertTrue(self.root.is_relative_to(TEMP_ROOT.resolve()))
        self.temp.cleanup()
    def test_declared_distinct_sources_validate_before_writing(self):
        _,_,_,items=helper.validate(self.root,self.profile,self.data,self.decision)
        self.assertEqual(len(items),5)
        self.assertEqual(list((self.root/'assets/brand/classic').iterdir()),[])
    def test_requires_integration_authorization(self):
        self.decision['activationApproved']=False
        with self.assertRaisesRegex(ValueError,'integration'):helper.validate(self.root,self.profile,self.data,self.decision)
    def test_staged_check_verifies_files_without_creating_an_owner_decision(self):
        _,_,_,items=helper.validate_candidate(self.root,self.profile,self.data)
        self.assertEqual(len(items),5)
        self.assertEqual(list((self.root/'assets/brand/classic').iterdir()),[])
        with self.assertRaisesRegex(ValueError,'integration'):helper.validate(self.root,self.profile,self.data,{})
    def test_rejects_changed_prepared_bytes(self):
        path=self.root/self.data['outputs'][0]['localArtifactPath'];path.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'bytes changed'):helper.validate(self.root,self.profile,self.data,self.decision)
    def test_rejects_escaping_destination(self):
        self.data['files'][0]['path']='../outside.png'
        with self.assertRaisesRegex(ValueError,'escapes'):helper.validate(self.root,self.profile,self.data,self.decision)
    def test_rejects_pixel_derivative_mismatch_even_with_updated_hash(self):
        item=self.data['outputs'][0];path=self.root/item['localArtifactPath']
        with Image.open(path) as raw:im=raw.copy();icc=raw.info['icc_profile']
        im.putpixel((54,54),(255,0,0,255));im.save(path,icc_profile=icc)
        item['sha256']=helper.sha(path)
        with self.assertRaisesRegex(ValueError,'distinct source transform'):helper.validate(self.root,self.profile,self.data,self.decision)
    def test_splash_contract_rejects_missing_configuration(self):
        configured=self.profile['assets'].pop('classic-adaptive')
        self.profile['assets']['classic-splash']=configured;self.profile['policies']['queue']=['classic-splash']
        self.data['assetId']=self.decision['assetId']='classic-splash'
        configured['requiredOutputContract']={'configurationPx':288,'androidPx':[76,114,152,228,304]}
        registry=self.root/self.data['registryPath']
        registry.write_text(json.dumps({'exports':[{'id':'classic-splash','approval':None,'productionFiles':None}]}))
        self.data['expectedRegistrySha256']=helper.sha(registry)
        with self.assertRaisesRegex(ValueError,'splash configuration/density'):helper.validate(self.root,self.profile,self.data,self.decision)
    def test_ordinary_affine_still_rejects_source_enlargement(self):
        source=self.root/self.data['layerSources'][0]['localArtifactPath']
        with self.assertRaisesRegex(ValueError,'must not enlarge'):
            helper.manual_pixels(source,{'kind':'uniform-affine','size':[1152,1152],
                'sourceCenterPx':[233,243],'dpPerSourcePx':.3777480127985562,'layerSizeDp':288})
    def test_splash_density_affine_preserves_logical_geometry_with_bounded_interpolation(self):
        source=self.root/self.data['layerSources'][0]['localArtifactPath']
        bounds=[]
        for n in (288,432,576,864,1152):
            transform={'kind':'splash-density-affine','size':[n,n],'sourceCenterPx':[233,243],
                'dpPerSourcePx':.3777480127985562,'layerSizeDp':288,
                'interpolationPolicy':'preserve-current-splash-size'}
            image=helper.manual_pixels(source,transform)
            box=image.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
            bounds.append(tuple(value/(n/288) for value in box))
            self.assertEqual(image.size,(n,n));self.assertEqual(image.mode,'RGBA')
            self.assertEqual(image.getpixel((0,0))[3],0)
        for box in bounds[1:]:
            for actual,expected in zip(box,bounds[0]):self.assertLess(abs(actual-expected),1.1)
    def test_splash_interpolation_requires_exact_geometry_and_disclosure(self):
        source=self.root/self.data['layerSources'][0]['localArtifactPath']
        transform={'kind':'splash-density-affine','size':[1152,1152],'sourceCenterPx':[233,243],
            'dpPerSourcePx':.3777480127985562,'layerSizeDp':288,
            'interpolationPolicy':'preserve-current-splash-size'}
        for patch in ({'size':[1440,1440]},{'sourceCenterPx':[233,242]},
                      {'dpPerSourcePx':.4},{'layerSizeDp':240},{'interpolationPolicy':None}):
            with self.assertRaisesRegex(ValueError,'geometry|disclosed'):helper.manual_pixels(source,{**transform,**patch})
    def test_splash_transform_cannot_be_used_for_another_brand_asset(self):
        item=self.data['outputs'][0]
        item['manualExportSpec']={'kind':'splash-density-affine','size':[108,108]}
        with self.assertRaisesRegex(ValueError,'belongs only'):helper.validate(self.root,self.profile,self.data,self.decision)
    def test_native_vector_requires_white_alpha_shape(self):
        path=self.root/'verification/local/artwork/notification.xml'
        content='<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FFFFFFFF" android:pathData="M2,2 L22,2 L12,22 Z" /></vector>'
        path.write_text(content)
        self.assertEqual(helper.inspect_vector(path)['pathCount'],1)
        path.write_text(content.replace('#FFFFFFFF','#FF123456'))
        with self.assertRaisesRegex(ValueError,'must be white'):helper.inspect_vector(path)
    def test_native_vector_rejects_declarations_and_wrong_viewport(self):
        path=self.root/'verification/local/artwork/notification.xml'
        path.write_text('<!DOCTYPE vector><vector />')
        with self.assertRaisesRegex(ValueError,'declarations/entities'):helper.inspect_vector(path)
        path.write_text('<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="56" android:viewportHeight="56" />')
        with self.assertRaisesRegex(ValueError,'viewport24'):helper.inspect_vector(path)
    def test_rejects_reusing_an_approved_version(self):
        registry=self.root/self.data['registryPath']
        registry.write_text(json.dumps({'exports':[{'id':'classic-adaptive','activeVersion':1,'approval':{'path':'old.json'},'productionFiles':[]}]}))
        self.data['expectedRegistrySha256']=helper.sha(registry)
        with self.assertRaisesRegex(ValueError,'next reviewed revision'):helper.validate(self.root,self.profile,self.data,self.decision)
    def test_new_version_keeps_complete_previous_entry(self):
        registry=self.root/self.data['registryPath'];old={'id':'classic-adaptive','activeVersion':1,'reviewCandidate':1,
            'approval':{'path':'docs/design/production-assets/old.json','ownerStatement':'Original decision'},
            'productionFiles':[{'path':'assets/brand/classic/old.png','sha256':'original-bytes'}],
            'technicalLimitations':['Preserve original limitation'],'candidateRecords':['old-candidate.json']}
        registry.write_text(json.dumps({'exports':[old]}));self.data['expectedRegistrySha256']=helper.sha(registry)
        self.data['version']=self.decision['version']=2;self.data['candidate']=2
        helper.promote(self.root,self.profile,self.data,self.decision)
        active=json.loads(registry.read_text())['exports'][0]
        self.assertEqual(active['activeVersion'],2);self.assertEqual(active['approvedVersionHistory'],[old])
        self.assertEqual(active['candidateRecords'][0],'old-candidate.json')

if __name__=='__main__':unittest.main()
