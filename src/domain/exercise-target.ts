import type { ExerciseTarget, RoutineExercise } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { t, type Translator } from '../localization';

export const positiveTargetNumber = (value: unknown, integer = false): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER && (!integer || Number.isInteger(value));
/** Match BigDecimal.toPlainString on Android, including small authored decimals. */
export function targetNumberText(value:number):string {
  const raw=String(value);if(!raw.includes('e'))return raw;
  const [coefficient,exponent]=raw.split('e'),[whole,fraction='']=coefficient.split('.'),digits=whole+fraction,point=whole.length+Number(exponent);
  return point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point);
}
export function validExerciseTarget(value: ExerciseTarget | undefined): boolean {
  if (!value) return true;
  return Object.keys(value).length > 0 && Object.keys(value).every(key => ['sets','reps','repsMax','duration','eachSide','weight','additionalText'].includes(key)) &&
    ['sets','reps','repsMax'].every(key => value[key as 'sets'] === undefined || positiveTargetNumber(value[key as 'sets'], true)) &&
    (value.repsMax === undefined || value.reps !== undefined && value.repsMax >= value.reps) &&
    (value.duration === undefined || Object.keys(value.duration).length===2 && positiveTargetNumber(value.duration.value) && ['sec','min','hr'].includes(value.duration.unit)) &&
    (value.eachSide === undefined || value.eachSide === true && (value.reps !== undefined || value.duration !== undefined)) &&
    (value.weight === undefined || Object.keys(value.weight).length===2 && positiveTargetNumber(value.weight.value) && ['kg','lb'].includes(value.weight.unit)) &&
    (value.additionalText === undefined || typeof value.additionalText === 'string' && !!value.additionalText.trim() && value.additionalText.length <= 1000);
}
export const validExercise = (value: RoutineExercise) => !!value.name.trim() && value.name.length <= 200 && value.target.length <= 1000 && value.notes.length <= 10000 &&
  validExerciseTarget(value.exerciseTarget) && (!value.exerciseTarget || !value.target);

/** Authored text is never translated or parsed. Both platforms use the same message keys. */
export function exerciseTargetText(step: Pick<RoutineExercise, 'target' | 'exerciseTarget'>, translate: Translator = t): string {
  const value = step.exerciseTarget;
  if (!value) return step.target;
  const reps = value.reps === undefined ? '' : value.repsMax === undefined ? translate('exercise_count_reps', { count: targetNumberText(value.reps) }) : translate('exercise_range_reps', { min: value.reps, max: value.repsMax });
  const time = value.duration ? translate(value.duration.unit === 'sec' ? 'exercise_seconds_short' : value.duration.unit === 'min' ? 'exercise_minutes_short' : 'exercise_hours_short', { count: targetNumberText(value.duration.value) }) : '';
  const sets = value.sets === undefined ? '' : translate('exercise_count_sets', { count: targetNumberText(value.sets) });
  let amount = reps && time ? [sets, translate('exercise_per_set', { value: reps }), translate('exercise_per_set', { value: time })].filter(Boolean).join(' · ') : [sets,reps || time].filter(Boolean).join(' × ');
  if (value.eachSide) amount = translate('exercise_each_side_summary', { value: amount });
  return [amount, value.weight ? `${targetNumberText(value.weight.value)} ${value.weight.unit}` : '', value.additionalText].filter(Boolean).join(' · ');
}

export type ExerciseTargetFields = { mode: 'Numeric' | 'Text'; preserveStructured: boolean; custom: string; sets: string; reps: string; repsMax: string; range: boolean;
  duration: string; unit: 'sec' | 'min' | 'hr'; eachSide: boolean; weight: string; weightUnit: 'kg' | 'lb'; additionalText: string };
export function targetFields(step: RoutineExercise, general = false): ExerciseTargetFields {
  const value = step.exerciseTarget;
  const number = (n:number | undefined) => n === undefined ? '' : targetNumberText(n);
  return { mode: general || !value && !!step.target ? 'Text' : 'Numeric', preserveStructured:general&&!!value, custom: exerciseTargetText(step), sets: number(value?.sets), reps: number(value?.reps),
    repsMax: number(value?.repsMax), range: value?.repsMax !== undefined, duration: number(value?.duration?.value), unit: value?.duration?.unit ?? 'sec',
    eachSide: value?.eachSide ?? false, weight: number(value?.weight?.value), weightUnit: value?.weight?.unit ?? 'kg', additionalText: value?.additionalText ?? '' };
}
export type TargetFieldError = 'number' | 'integer' | 'range' | 'side' | 'length';
export function targetFieldErrors(fields: ExerciseTargetFields): Partial<Record<keyof ExerciseTargetFields, TargetFieldError>> {
  if (fields.mode === 'Text') return fields.custom.length <= 1000 ? {} : { custom: 'length' };
  const errors: Partial<Record<keyof ExerciseTargetFields, TargetFieldError>> = {};
  for (const key of ['sets','reps','repsMax','duration','weight'] as const) {
    if (key === 'repsMax' && !fields.range || !fields[key].trim()) continue;
    const integer = ['sets','reps','repsMax'].includes(key), raw = fields[key].trim();
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) || !positiveTargetNumber(Number(raw), integer)) errors[key] = integer ? 'integer' : 'number';
  }
  if (fields.range && (!fields.reps.trim() || !fields.repsMax.trim() || Number(fields.repsMax) < Number(fields.reps))) errors.repsMax = 'range';
  if (fields.eachSide && !fields.reps.trim() && !fields.duration.trim()) errors.eachSide = 'side';
  if (fields.additionalText.length > 1000) errors.additionalText = 'length';
  return errors;
}
export function applyTargetFields(step: RoutineExercise, fields: ExerciseTargetFields, original: ExerciseTargetFields): RoutineExercise {
  // Editing a General name/description must not flatten an existing structured target.
  if (fields.mode === 'Text') return original.preserveStructured && fields.custom === original.custom && step.exerciseTarget ? step : { ...step, target: fields.custom, exerciseTarget: undefined };
  const value: ExerciseTarget = {};
  for (const key of ['sets','reps'] as const) if (fields[key].trim()) value[key] = Number(fields[key]);
  if (fields.range && fields.repsMax.trim()) value.repsMax = Number(fields.repsMax);
  if (fields.duration.trim()) value.duration = { value: Number(fields.duration), unit: fields.unit };
  if (fields.eachSide) value.eachSide = true;
  if (fields.weight.trim()) value.weight = { value: Number(fields.weight), unit: fields.weightUnit };
  if (fields.additionalText.trim()) value.additionalText = fields.additionalText;
  return { ...step, target: '', exerciseTarget: Object.keys(value).length ? value : undefined };
}
