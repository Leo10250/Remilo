"""Current-only staging, integrity and interrupted-publication behavior."""
from __future__ import annotations
import copy, json, os, shutil, subprocess, sys, tempfile, unittest
from argparse import Namespace
from pathlib import Path
from unittest import mock
from PIL import Image
SCRIPTS=Path(__file__).resolve().parents[1]/'scripts'
sys.path.insert(0,str(SCRIPTS))
import asset_workflow as workflow
import asset_common as common

class CurrentWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='.current-assets-',dir=os.environ.get('VISUAL_ASSET_TEST_TMP',Path.cwd()))
        self.root=Path(self.temp.name)
        (self.root/'assets').mkdir()
        self.source=self.root/'assets/source.png';Image.new('RGB',(40,24),'#204060').save(self.source)
        self.input=self.root/'new.png';Image.new('RGB',(40,24),'#b05030').save(self.input)
        self.profile={'schemaVersion':2,'localRoot':'verification/local/artwork','allowedOutputRoots':['verification/local/artwork','assets'],'manifests':{'images':'assets/manifest.json'}}
        output=self.root/'assets/runtime.webp';common.encode_image(common.render_export(self.source,{'size':[20,12]})[0],output,'WEBP')
        copy_path=self.root/'assets/copy.webp';copy_path.write_bytes(output.read_bytes())
        asset={'sources':{'master':{'path':'assets/source.png',**workflow.measured(self.source)}},'outputs':{'runtime':{'path':'assets/runtime.webp',**workflow.measured(output),'source':'master','transform':{'kind':'raster','fit':'cover','lossless':True,'allowUpscale':False},'copies':['assets/copy.webp']}}}
        self.manifest=self.root/'assets/manifest.json';common.atomic_json(self.manifest,{'schemaVersion':2,'assets':{'picture':asset}})
        self.inspection=self.root/'inspection.json';common.atomic_json(self.inspection,{'checks':[{'name':'usage','status':'pass','observation':'Viewed the staged export at its intended use.'}]})
    def tearDown(self):self.temp.cleanup()
    def snapshot(self):return {str(p.relative_to(self.root)):common.sha(p) for p in self.root.rglob('*') if p.is_file()}
    def production_snapshot(self):return {p.relative_to(self.root).as_posix():common.sha(p) for p in (self.root/'assets').rglob('*') if p.is_file()}
    def stage(self):
        result=workflow.stage_asset(self.root,self.profile,Namespace(asset='picture',run='candidate-a',manifest='images',spec=None,source=str(self.input),source_role='master'))
        return result['record']
    def reviewed(self,inspection=True):
        record=self.stage();result=workflow.review(self.root,self.profile,Namespace(record=record,review_id='view-a',inspection=str(self.inspection) if inspection else None))
        return Namespace(record=record,review=result['review'])
    def test_inspection_and_audit_do_not_write_reports_by_default(self):
        before=self.snapshot();workflow.measured(self.source);self.assertEqual(workflow.audit(self.root,self.profile,Namespace(report=None))['findings'],[]);self.assertEqual(self.snapshot(),before)
    def test_staging_and_review_leave_all_production_bytes_unchanged(self):
        before={p:common.sha(self.root/p) for p in ['assets/source.png','assets/runtime.webp','assets/copy.webp','assets/manifest.json']}
        self.reviewed();self.assertEqual({p:common.sha(self.root/p) for p in before},before)
        self.assertFalse((self.root/'docs').exists())
    def test_publish_updates_current_entry_and_copies_without_permanent_dossier(self):
        args=self.reviewed();workflow.promote(self.root,self.profile,args)
        current=common.load_json(self.manifest);self.assertEqual(current['assets']['picture']['sources']['master']['sha256'],common.sha(self.input))
        self.assertEqual((self.root/'assets/runtime.webp').read_bytes(),(self.root/'assets/copy.webp').read_bytes())
        self.assertEqual(workflow.audit(self.root,self.profile,Namespace(report=None))['findings'],[])
        self.assertNotIn('approval',json.dumps(current));self.assertNotIn('history',json.dumps(current))
        self.assertTrue(workflow.promote(self.root,self.profile,args)['alreadyApplied'])
        self.assertFalse((self.root/'verification/local/artwork/candidate-a/publication.json').exists())
    def test_schema1_profiles_and_manifests_fail_with_migration_message(self):
        with self.assertRaisesRegex(ValueError,'Migrate'):workflow.profile_roots(self.root,{**self.profile,'schemaVersion':1})
        self.manifest.write_text('{"schemaVersion":1,"assets":{}}')
        with self.assertRaisesRegex(ValueError,'Migrate'):self.stage()
    def test_manifest_selection_must_be_explicit_and_configured(self):
        with self.assertRaisesRegex(ValueError,'explicitly configured'):workflow.manifest_file(self.root,self.profile,'assets/other.json')
    def test_prepared_bytes_cannot_change_after_review(self):
        args=self.reviewed();record=common.load_json(self.root/args.record);(self.root/record['files'][-1]['path']).write_bytes(b'changed')
        before=common.sha(self.manifest)
        with self.assertRaisesRegex(ValueError,'bytes changed'):workflow.promote(self.root,self.profile,args)
        self.assertEqual(common.sha(self.manifest),before)
    def test_pending_visual_review_cannot_publish(self):
        args=self.reviewed(False)
        with self.assertRaisesRegex(ValueError,'actual visual inspection'):workflow.promote(self.root,self.profile,args)
    def test_presented_panel_bytes_are_bound_to_review(self):
        args=self.reviewed();review=common.load_json(self.root/args.review);(self.root/review['panels'][0]['path']).write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'preview changed'):workflow.promote(self.root,self.profile,args)
    def test_profile_change_invalidates_staged_run(self):
        args=self.reviewed();profile=copy.deepcopy(self.profile);profile['authorityFiles']=['new.md']
        with self.assertRaisesRegex(ValueError,'Profile changed'):workflow.promote(self.root,profile,args)
    def test_manifest_change_does_not_get_overwritten(self):
        args=self.reviewed();self.manifest.write_text(self.manifest.read_text()+' ')
        with self.assertRaisesRegex(ValueError,'manifest changed'):workflow.promote(self.root,self.profile,args)
    def test_last_changed_target_fails_before_any_production_mutation(self):
        args=self.reviewed();(self.root/'assets/copy.webp').write_bytes(b'other writer');before=self.snapshot()
        with self.assertRaisesRegex(ValueError,'target changed'):workflow.promote(self.root,self.profile,args)
        self.assertEqual(self.snapshot(),before)
    def test_output_escape_is_rejected_before_creating_run(self):
        manifest=common.load_json(self.manifest);manifest['assets']['picture']['outputs']['runtime']['copies']=['../outside.webp'];self.manifest.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError,'escape'):self.stage()
        self.assertFalse((self.root/'verification/local/artwork').exists())
    def test_existing_publication_lock_is_not_removed(self):
        args=self.reviewed();lock=self.root/'verification/local/artwork/.publish.lock';lock.write_text('another process')
        with self.assertRaisesRegex(ValueError,'lock exists'):workflow.promote(self.root,self.profile,args)
        self.assertEqual(lock.read_text(),'another process')
    def test_interrupted_copy_retries_exact_run_without_partial_file_or_history(self):
        args=self.reviewed();before=common.sha(self.manifest);original=workflow.atomic_copy;calls=0
        def interrupted(source,target,expected_sha256):
            nonlocal calls
            calls+=1
            if calls==2:raise OSError('fixture interrupted write')
            return original(source,target,expected_sha256)
        with mock.patch.object(workflow,'atomic_copy',side_effect=interrupted):
            with self.assertRaisesRegex(OSError,'interrupted'):workflow.promote(self.root,self.profile,args)
        self.assertEqual(common.sha(self.manifest),before)
        journal=self.root/'verification/local/artwork/candidate-a/publication.json';self.assertTrue(journal.exists())
        workflow.promote(self.root,self.profile,args);self.assertFalse(journal.exists());self.assertEqual(workflow.audit(self.root,self.profile,Namespace(report=None))['findings'],[])
    def test_interrupted_manifest_commit_is_idempotently_recoverable(self):
        args=self.reviewed();original=workflow.atomic_copy
        def interrupted(source,target,expected_sha256):
            if Path(target)==self.manifest:raise OSError('fixture manifest interruption')
            return original(source,target,expected_sha256)
        with mock.patch.object(workflow,'atomic_copy',side_effect=interrupted):
            with self.assertRaisesRegex(OSError,'manifest interruption'):workflow.promote(self.root,self.profile,args)
        workflow.promote(self.root,self.profile,args);self.assertTrue(workflow.promote(self.root,self.profile,args)['alreadyApplied'])
    def test_changed_recovery_manifest_rejects_before_further_production_writes(self):
        args=self.reviewed();original=workflow.atomic_copy
        def interrupted(source,target,expected_sha256):
            if Path(target)==self.manifest:raise OSError('fixture interruption')
            return original(source,target,expected_sha256)
        with mock.patch.object(workflow,'atomic_copy',side_effect=interrupted):
            with self.assertRaises(OSError):workflow.promote(self.root,self.profile,args)
        journal=common.load_json(self.root/'verification/local/artwork/candidate-a/publication.json')
        (self.root/journal['manifestStage']).write_text('{"schemaVersion":2,"assets":{}}')
        before=self.snapshot()
        with self.assertRaisesRegex(ValueError,'manifest stage changed'):workflow.promote(self.root,self.profile,args)
        self.assertEqual(self.snapshot(),before)
    def assert_staged_asset_race_is_recoverable(self, during_backup):
        args=self.reviewed();record=common.load_json(self.root/args.record);run=(self.root/args.record).parent
        entry=record['files'][0 if during_backup else -1]
        staged=self.root/entry['path'];target=self.root/entry['destination']
        reviewed_bytes=staged.read_bytes();previous_target=target.read_bytes();previous_manifest=self.manifest.read_bytes()
        changed=False
        if during_backup:
            original=workflow.stage_backup
            def concurrent_save(source,destination,expected):
                nonlocal changed
                result=original(source,destination,expected)
                if not changed:
                    staged.write_bytes(b'changed staged asset during backup');changed=True
                return result
            operation=mock.patch.object(workflow,'stage_backup',side_effect=concurrent_save)
        else:
            original=workflow.atomic_copy
            def concurrent_save(source,destination,expected_sha256):
                nonlocal changed
                if Path(destination)==target and not changed:
                    staged.write_bytes(b'changed staged asset during publication');changed=True
                return original(source,destination,expected_sha256)
            operation=mock.patch.object(workflow,'atomic_copy',side_effect=concurrent_save)
        with operation:
            with self.assertRaises(ValueError):workflow.promote(self.root,self.profile,args)
        self.assertTrue(changed,'The staged file must change after initial preparation validation')
        self.assertEqual(target.read_bytes(),previous_target)
        self.assertEqual(self.manifest.read_bytes(),previous_manifest)
        journal=run/'publication.json';self.assertTrue(journal.is_file())
        self.assertFalse(list(target.parent.glob('*.asset-tmp')))
        staged.write_bytes(reviewed_bytes)
        workflow.promote(self.root,self.profile,args)
        self.assertFalse(journal.exists())
        self.assertEqual(common.load_json(self.manifest)['assets']['picture'],record['asset'])
        self.assertEqual(workflow.audit(self.root,self.profile,Namespace(report=None))['findings'],[])
        self.assertTrue(workflow.promote(self.root,self.profile,args)['alreadyApplied'])
    def test_staged_asset_changed_during_backup_preserves_target_and_exact_retry(self):
        self.assert_staged_asset_race_is_recoverable(True)
    def test_staged_asset_changed_during_publication_preserves_target_and_exact_retry(self):
        self.assert_staged_asset_race_is_recoverable(False)
    def test_manifest_stage_changed_after_precheck_preserves_manifest_and_exact_retry(self):
        args=self.reviewed();record=common.load_json(self.root/args.record);run=(self.root/args.record).parent
        previous_manifest=self.manifest.read_bytes();original=workflow.atomic_copy;changed={}
        def concurrent_save(source,target,expected_sha256):
            if Path(target)==self.manifest:
                stage=Path(source);changed['path']=stage;changed['bytes']=stage.read_bytes()
                stage.write_text('{"schemaVersion":2,"assets":{}}',encoding='utf-8')
            return original(source,target,expected_sha256)
        with mock.patch.object(workflow,'atomic_copy',side_effect=concurrent_save):
            with self.assertRaises(ValueError):workflow.promote(self.root,self.profile,args)
        self.assertTrue(changed,'The manifest stage must change after its final precheck')
        self.assertEqual(self.manifest.read_bytes(),previous_manifest)
        for entry in record['files']:
            self.assertEqual(common.sha(self.root/entry['destination']),entry['sha256'])
        journal=run/'publication.json';self.assertTrue(journal.is_file())
        self.assertFalse(list(self.manifest.parent.glob('*.asset-tmp')))
        changed['path'].write_bytes(changed['bytes'])
        workflow.promote(self.root,self.profile,args)
        self.assertFalse(journal.exists())
        self.assertEqual(common.load_json(self.manifest)['assets']['picture'],record['asset'])
        self.assertEqual(workflow.audit(self.root,self.profile,Namespace(report=None))['findings'],[])
        self.assertTrue(workflow.promote(self.root,self.profile,args)['alreadyApplied'])
    def fail_before_initial_journal(self, fault):
        args=self.reviewed();run=(self.root/args.record).parent;before=self.production_snapshot()
        if fault == 'backup':
            original=workflow.shutil.copyfile
            def interrupted(source,target):
                if run/'backups' in Path(target).parents:
                    Path(target).write_bytes(b'partial fixture backup')
                    raise OSError('fixture backup copy interruption')
                return original(source,target)
            operation=mock.patch.object(workflow.shutil,'copyfile',side_effect=interrupted)
        else:
            original=workflow.atomic_json
            def interrupted(path,value,**options):
                if Path(path) == run/'publication.json':raise OSError('fixture initial journal interruption')
                return original(path,value,**options)
            operation=mock.patch.object(workflow,'atomic_json',side_effect=interrupted)
        with operation:
            with self.assertRaisesRegex(OSError,'fixture .* interruption'):workflow.promote(self.root,self.profile,args)
        self.assertTrue((run/'manifest.json').is_file())
        self.assertFalse((run/'publication.json').exists())
        self.assertEqual(self.production_snapshot(),before)
        return args,run,before
    def test_backup_failure_before_initial_journal_retries_exact_reviewed_run(self):
        args,run,_=self.fail_before_initial_journal('backup')
        workflow.promote(self.root,self.profile,args)
        self.assertFalse((run/'publication.json').exists())
        self.assertEqual(workflow.audit(self.root,self.profile,Namespace(report=None))['findings'],[])
        self.assertTrue(workflow.promote(self.root,self.profile,args)['alreadyApplied'])
    def test_initial_journal_write_failure_retries_exact_reviewed_run(self):
        args,run,_=self.fail_before_initial_journal('journal')
        workflow.promote(self.root,self.profile,args)
        self.assertFalse((run/'publication.json').exists())
        self.assertEqual(workflow.audit(self.root,self.profile,Namespace(report=None))['findings'],[])
        self.assertTrue(workflow.promote(self.root,self.profile,args)['alreadyApplied'])
    def test_tampered_orphan_manifest_stage_is_refused_before_production_writes(self):
        args,run,before=self.fail_before_initial_journal('journal')
        stage=run/'manifest.json';stage.write_text('{"schemaVersion":2,"assets":{}}',encoding='utf-8')
        changed_stage=stage.read_bytes()
        with self.assertRaisesRegex(ValueError,'manifest.*(changed|differs)|orphan|stage'):
            workflow.promote(self.root,self.profile,args)
        self.assertEqual(self.production_snapshot(),before)
        self.assertEqual(stage.read_bytes(),changed_stage)
        self.assertFalse((run/'publication.json').exists())
    def test_changed_published_backup_is_refused_before_initial_journal_retry(self):
        args,run,before=self.fail_before_initial_journal('journal')
        backup=run/'backups'/'0';self.assertTrue(backup.is_file());backup.write_bytes(b'unknown changed backup')
        with self.assertRaisesRegex(ValueError,'[Bb]ackup changed'):
            workflow.promote(self.root,self.profile,args)
        self.assertEqual(self.production_snapshot(),before)
        self.assertEqual(backup.read_bytes(),b'unknown changed backup')
        self.assertFalse((run/'publication.json').exists())
    def test_atomic_file_failure_does_not_publish_partial_bytes(self):
        target=self.root/'assets/target.webp';target.write_bytes(b'old')
        with mock.patch.object(workflow.os,'replace',side_effect=OSError('fixture replace failure')):
            with self.assertRaises(OSError):workflow.atomic_copy(self.input,target,common.sha(self.input))
        self.assertEqual(target.read_bytes(),b'old');self.assertFalse(list(target.parent.glob('*.asset-tmp')))
    def add_other_asset(self,other_manifest=False):
        source=self.root/'assets/other-source.png';Image.new('RGB',(40,24),'#609020').save(source)
        output=self.root/'assets/other.webp';common.encode_image(common.render_export(source,{'size':[20,12]})[0],output,'WEBP')
        asset={'sources':{'master':{'path':'assets/other-source.png',**workflow.measured(source)}},'outputs':{'runtime':{'path':'assets/other.webp',**workflow.measured(output),'source':'master','transform':{'kind':'raster','fit':'cover','lossless':True},'copies':[]}}}
        if other_manifest:
            target=self.root/'assets/other-manifest.json';common.atomic_json(target,{'schemaVersion':2,'assets':{'other':asset}});self.profile['manifests']['other']='assets/other-manifest.json'
        else:
            data=common.load_json(self.manifest);data['assets']['other']=asset;common.atomic_json(self.manifest,data,replace=True)
        self.assertEqual(workflow.audit(self.root,self.profile,Namespace(report=None))['findings'],[])
        return asset
    def test_changed_spec_cannot_claim_another_assets_output_before_staging(self):
        self.add_other_asset();asset=copy.deepcopy(common.load_json(self.manifest)['assets']['picture']);asset['outputs']['runtime']['path']='assets/other.webp'
        spec=self.root/'spec.json';common.atomic_json(spec,asset);before=self.snapshot()
        with self.assertRaisesRegex(ValueError,'another asset'):
            workflow.stage_asset(self.root,self.profile,Namespace(asset='picture',run='conflict',manifest='images',spec=str(spec),source=str(self.input),source_role='master'))
        self.assertEqual(self.snapshot(),before)
    def test_output_ownership_is_checked_across_every_configured_manifest(self):
        self.add_other_asset(True);asset=copy.deepcopy(common.load_json(self.manifest)['assets']['picture']);asset['outputs']['runtime']['copies']=['assets/other.webp']
        spec=self.root/'spec.json';common.atomic_json(spec,asset);before=self.snapshot()
        with self.assertRaisesRegex(ValueError,'another asset'):
            workflow.stage_asset(self.root,self.profile,Namespace(asset='picture',run='conflict',manifest='images',spec=str(spec),source=str(self.input),source_role='master'))
        self.assertEqual(self.snapshot(),before)
    def assert_alias_cannot_claim_other_asset(self, alias, kind):
        asset=copy.deepcopy(common.load_json(self.manifest)['assets']['picture'])
        if kind == 'output':asset['outputs']['runtime']['path']=alias
        else:asset['sources']['master']['path']=alias
        spec=self.root/'alias-spec.json';common.atomic_json(spec,asset);before=self.snapshot()
        with self.assertRaisesRegex(ValueError,'another asset|Shared source bytes'):
            workflow.stage_asset(self.root,self.profile,Namespace(asset='picture',run='alias-conflict',manifest='images',spec=str(spec),source=str(self.input),source_role='master'))
        self.assertEqual(self.snapshot(),before)
    def require_case_insensitive_asset_paths(self):
        if not (self.root/'assets/SOURCE.png').is_file():self.skipTest('Fixture filesystem distinguishes filename case')
    def test_case_alias_cannot_claim_another_assets_output(self):
        self.require_case_insensitive_asset_paths();self.add_other_asset()
        self.assert_alias_cannot_claim_other_asset('assets/OTHER.webp','output')
    def test_case_alias_cannot_replace_another_assets_source(self):
        self.require_case_insensitive_asset_paths();self.add_other_asset()
        self.assert_alias_cannot_claim_other_asset('assets/OTHER-SOURCE.png','source')
    def internal_asset_alias(self):
        alias=self.root/'asset-alias';target=self.root/'assets'
        try:alias.symlink_to(target,target_is_directory=True)
        except (OSError,NotImplementedError) as error:
            shell=shutil.which('powershell.exe') if os.name == 'nt' else None
            if not shell:self.skipTest(f'Host does not permit directory links: {error}')
            environment=dict(os.environ);environment['VISUAL_ASSET_TEST_LINK']=str(alias);environment['VISUAL_ASSET_TEST_TARGET']=str(target)
            made=subprocess.run([shell,'-NoProfile','-NonInteractive','-Command',
                'New-Item -ItemType Junction -Path $env:VISUAL_ASSET_TEST_LINK -Target $env:VISUAL_ASSET_TEST_TARGET -ErrorAction Stop | Out-Null'],
                env=environment,capture_output=True,text=True)
            if made.returncode:self.skipTest(f'Host also denied a directory junction: {made.stderr}')
        self.assertEqual(alias.resolve(),target.resolve())
        return alias
    def test_internal_directory_alias_cannot_claim_another_assets_output(self):
        self.add_other_asset();alias=self.internal_asset_alias()
        try:self.assert_alias_cannot_claim_other_asset('asset-alias/other.webp','output')
        finally:
            if alias.is_symlink():alias.unlink()
            else:alias.rmdir()  # Remove only the junction, never its target.
    def test_internal_directory_alias_cannot_replace_another_assets_source(self):
        self.add_other_asset();alias=self.internal_asset_alias()
        try:self.assert_alias_cannot_claim_other_asset('asset-alias/other-source.png','source')
        finally:
            if alias.is_symlink():alias.unlink()
            else:alias.rmdir()  # Remove only the junction, never its target.
    def test_source_can_be_shared_only_without_changing_its_bytes(self):
        other=self.add_other_asset();data=common.load_json(self.manifest);data['assets']['other']['sources']['shared']=copy.deepcopy(data['assets']['picture']['sources']['master']);common.atomic_json(self.manifest,data,replace=True)
        before=self.snapshot()
        with self.assertRaisesRegex(ValueError,'Shared source bytes'):self.stage()
        self.assertEqual(self.snapshot(),before)
        result=workflow.stage_asset(self.root,self.profile,Namespace(asset='picture',run='same-source',manifest='images',spec=None,source=None))
        self.assertFalse(result['productionFilesWritten'])
    def test_ownership_change_after_review_rejects_before_production_writes(self):
        self.add_other_asset(True);args=self.reviewed();other_path=self.root/'assets/other-manifest.json';data=common.load_json(other_path)
        data['assets']['other']['outputs']['runtime']['copies']=['assets/runtime.webp'];common.atomic_json(other_path,data,replace=True)
        before=self.snapshot()
        with self.assertRaisesRegex(ValueError,'another asset'):workflow.promote(self.root,self.profile,args)
        self.assertEqual(self.snapshot(),before)
    def test_replaced_source_does_not_inherit_stale_color_interpretation(self):
        data=common.load_json(self.manifest);data['assets']['picture']['sources']['master']['colorInterpretation']='Old untagged RGB assumption';common.atomic_json(self.manifest,data,replace=True)
        record=common.load_json(self.root/self.stage());self.assertNotIn('colorInterpretation',record['asset']['sources']['master'])
    def assert_current_source_change_is_rejected(self, after_copy=False):
        before=self.production_snapshot();original=workflow.shutil.copyfile;changed=False
        def concurrent_save(source,target):
            nonlocal changed
            if Path(source) == self.source and not changed:
                if after_copy:result=original(source,target)
                changed=True;self.source.write_bytes(self.input.read_bytes())
                if after_copy:return result
            return original(source,target)
        with mock.patch.object(workflow.shutil,'copyfile',side_effect=concurrent_save):
            with self.assertRaisesRegex(ValueError,'[Ss]ource.*(changed|differs)|[Ss]taged.*(changed|differs)'):
                workflow.stage_asset(self.root,self.profile,Namespace(asset='picture',run='current-source',manifest='images',spec=None,source=None))
        self.assertTrue(changed,'Fixture must save the source between validation and completion of staging')
        after=self.production_snapshot();self.assertEqual(after.pop('assets/source.png'),common.sha(self.input));before.pop('assets/source.png')
        self.assertEqual(after,before)
    def test_current_source_changed_before_staging_is_not_silently_rebaselined(self):
        self.assert_current_source_change_is_rejected()
    def test_current_source_changed_after_staging_copy_is_rejected(self):
        self.assert_current_source_change_is_rejected(after_copy=True)
    def test_new_asset_spec_does_not_require_fabricated_output_hashes(self):
        asset=copy.deepcopy(common.load_json(self.manifest)['assets']['picture']);asset['sources']['master']['path']='assets/new-source.png';asset['sources']['master'].pop('sha256');asset['outputs']['runtime']['path']='assets/new-runtime.webp';asset['outputs']['runtime'].pop('sha256');asset['outputs']['runtime']['copies']=[]
        spec=self.root/'new-spec.json';common.atomic_json(spec,asset)
        result=workflow.stage_asset(self.root,self.profile,Namespace(asset='new-picture',run='new-asset',manifest='images',spec=str(spec),source=str(self.input),source_role='master'))
        record=common.load_json(self.root/result['record']);self.assertEqual(len(record['asset']['outputs']['runtime']['sha256']),64);self.assertNotIn('new-picture',common.load_json(self.manifest)['assets'])
    def test_unknown_temporary_file_is_not_deleted_on_collision(self):
        target=self.root/'assets/target.webp'
        temporary=target.with_name(target.name+f'.{os.getpid()}.asset-tmp');temporary.write_bytes(b'other writer')
        with self.assertRaises(FileExistsError):workflow.atomic_copy(self.input,target,common.sha(self.input))
        self.assertEqual(temporary.read_bytes(),b'other writer');self.assertFalse(target.exists())
    def test_local_report_cannot_escape_working_storage(self):
        with self.assertRaisesRegex(ValueError,'under localRoot'):workflow.audit(self.root,self.profile,Namespace(report='assets/report.json'))

if __name__=='__main__':unittest.main()
