import {describe,expect,it} from 'vitest';
import fixtures from '../../verification/fixtures/exercise-targets.json';
import type {RoutineExercise,ExerciseTarget} from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import {createTranslator} from '../localization';
import {applyTargetFields,exerciseTargetText,numericTargetInput,targetFieldErrors,targetFields,validExerciseTarget} from './exercise-target';

const step:RoutineExercise={id:'stable',name:'Plank',target:'',notes:''};
describe('structured exercise targets',()=>{
  it('guards count and decimal editing without parsing partial input or stripping rejected pastes',()=>{
    for(const raw of ['', '0','003','12','9007199254740992']) expect(numericTargetInput('3',raw,true)).toBe(raw);
    for(const raw of ['3.0','3,0','+3','-3','1e3','12 reps',' 12','NaN','Infinity']) expect(numericTargetInput('3',raw,true)).toBe('3');
    for(const raw of ['', '.', '.5','0','1.','01.50']) expect(numericTargetInput('7.5',raw,false)).toBe(raw);
    expect(numericTargetInput('7.5','12,',false)).toBe('12.');
    expect(numericTargetInput('7.5',',5',false)).toBe('.5');
    expect(numericTargetInput('7.5','12,50',false)).toBe('12.50');
    for(const raw of ['7.5 kg','1,234.5','1,2,3','1..2','-1','+1','1e3','1 2']) expect(numericTargetInput('7.5',raw,false)).toBe('7.5');
    const fields=targetFields(step);
    expect(targetFieldErrors({...fields,sets:'3.0'})).toHaveProperty('sets');
    expect(targetFieldErrors({...fields,duration:'.'})).toHaveProperty('duration');
    expect(targetFieldErrors({...fields,duration:'1.',weight:'.5'})).toEqual({});
  });
  it('shares localized summaries with the native fixture',()=>{
    for(const fixture of fixtures)for(const language of ['en','zh-Hans'] as const) expect(exerciseTargetText(fixture as unknown as RoutineExercise,createTranslator(language))).toBe(fixture[language==='en'?'en':'zh']);
    for(const fixture of fixtures.filter(value=>value.exerciseTarget)) {
      const saved={...step,...fixture} as RoutineExercise,fields=targetFields(saved);
      expect(targetFieldErrors(fields)).toEqual({});
      expect(applyTargetFields(saved,fields,fields).exerciseTarget).toEqual(saved.exerciseTarget);
    }
  });
  it('keeps blank targets and units unspecified and never parses legacy text',()=>{
    const fields=targetFields(step);expect(fields.sets).toBe('');expect(fields.unit).toBe('sec');
    expect(applyTargetFields(step,{...fields,unit:'hr',weightUnit:'lb'},fields).exerciseTarget).toBeUndefined();
    const legacy={...step,target:'3 × 10, 6% incline'};expect(targetFields(legacy)).toMatchObject({mode:'Text',custom:legacy.target,sets:'',reps:'',duration:''});
    expect(applyTargetFields(legacy,targetFields(legacy),targetFields(legacy)).target).toBe(legacy.target);
  });
  it('rejects unsafe counts, decimals in counts, nonpositive and incomplete input before Done',()=>{
    const fields=targetFields(step);
    for(const sets of ['0','-1','1.5','NaN','Infinity','9007199254740992','1e3'])expect(targetFieldErrors({...fields,sets})).toHaveProperty('sets');
    expect(targetFieldErrors({...fields,sets:'3',duration:'1.5'})).toEqual({});
    expect(targetFieldErrors({...fields,range:true,reps:'10',repsMax:'8'})).toHaveProperty('repsMax');
    expect(targetFieldErrors({...fields,range:true,reps:'',repsMax:'10'})).toHaveProperty('repsMax');
    expect(targetFieldErrors({...fields,eachSide:true})).toHaveProperty('eachSide');
    expect(targetFieldErrors({...fields,range:false,repsMax:'bad',reps:'10'})).toEqual({});
  });
  it('keeps General presentation from flattening numeric targets unless its target text changes',()=>{
    const numeric={...step,exerciseTarget:{sets:3,reps:10}},fields=targetFields(numeric,true);
    expect(applyTargetFields({...numeric,notes:'New description'},fields,fields).exerciseTarget).toEqual(numeric.exerciseTarget);
    expect(applyTargetFields(numeric,{...fields,custom:'Read a chapter'},fields)).toMatchObject({target:'Read a chapter',exerciseTarget:undefined});
    const exerciseFields=targetFields(numeric);expect(applyTargetFields(numeric,{...exerciseFields,mode:'Text'},exerciseFields).exerciseTarget).toBeUndefined();
  });
  it('does not serialize unused range values and validates canonical representations',()=>{
    const fields=targetFields(step),value=applyTargetFields(step,{...fields,reps:'10',repsMax:'12',range:false},fields);
    expect(value.exerciseTarget).toEqual({reps:10});
    for(const target of [{sets:0},{reps:2.5},{repsMax:12},{eachSide:true},{duration:{value:1,unit:'days'}},{weight:{value:1,unit:'stone'}},{}])expect(validExerciseTarget(target as ExerciseTarget)).toBe(false);
    expect(validExerciseTarget({sets:3,reps:10,duration:{value:40,unit:'sec'}})).toBe(true);
  });
});
