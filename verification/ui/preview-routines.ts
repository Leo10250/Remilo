/** Memory-only routine fixture for actual component review. Never bundled on Android. */
import type { Command, CommandResult, RoutineDay, RoutineDraft, RoutinePlan, RoutineSession } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { civilAt } from '../../src/domain/time';

export const workoutWeek: RoutineDay[] = [
  ['Bird-dog|3×10', 'Front plank|3×40s', 'Side plank|3×25s/side', 'Intervals|8×(1 min fast / 1 min slow)'],
  ['Incline walk|35 min @ 6–8%'],
  ['Lat pulldown|100lb 3×10', 'Chest press|80lb 3×10', 'Face pull|17.5lb 3×12–15', 'Shoulder press|40lb 3×10', 'Incline hammer curl|20lb 3×10', 'Tricep pulldown|32lb 3×10–12', 'Easy jog|10 min'],
  ['Bird-dog|3×10', 'Front plank|3×30s', 'Easy walk|30 min'],
  ['Goblet squat|35lb 3×10', 'DB bench|30lb 3×10', 'DB RDL|25lb 3×10', '1-arm row|3×10', 'Easy walk|30 min'],
  ['Long walk|60 min'], [],
].map((exercises, day) => ({ type: exercises.length ? 'Exercises' : 'Rest', exercises: exercises.map((value, index) => ({ id: `exercise-${day}-${index}`, name: value.split('|')[0], target: value.split('|')[1], notes: '', illustration: '' })) }));

export function routinePreview(enabled: boolean, emit: () => void, options: { progress?: boolean; illustration?: boolean } = {}) {
  const currentDate = () => civilAt(Date.now()).slice(0, 10);
  const today = currentDate(), monday = new Date(today + 'T12:00:00');
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  const startsOn = civilAt(monday.getTime()).slice(0, 10);
  // Explicit authored fixture IDs only. Production never guesses artwork from exercise names.
  const illustrations: Record<string, string> = {
    'exercise-0-0': 'bird-dog-v1', 'exercise-0-1': 'front-plank-v1', 'exercise-0-2': 'side-plank-v1', 'exercise-0-3': 'running-v1',
    'exercise-2-6': 'running-v1', 'exercise-3-0': 'bird-dog-v1', 'exercise-3-1': 'front-plank-v1',
  };
  const guidance: Record<string, string> = { 'exercise-0-1': 'Complete all three holds, then continue.', 'exercise-3-1': 'Complete all three holds, then continue.' };
  const plan: RoutinePlan = { id: 'weekly', title: 'Weekly workout', notes: '', sound: 'remilo', vibration: false, revision: 1, state: 'Active', startsOn, effectiveDate: startsOn, minutes: 540, mode: 'Notification', listId: null,
    days: workoutWeek.map(day => ({ ...day, exercises: day.exercises.map(exercise => ({ ...exercise, notes: guidance[exercise.id] ?? '', illustration: options.illustration ? illustrations[exercise.id] ?? '' : '' })) })) };
  const plans: RoutinePlan[] = enabled ? [plan] : [];
  const sessions = new Map<string, RoutineSession>(), receipts = new Map<string, CommandResult>();
  const updateState = (value: RoutineSession) => {
    value.ended ||= value.date < currentDate();
    value.completedCount = value.steps.filter(step => step.completed).length;
    value.totalCount = value.steps.length;
    value.completed = value.totalCount > 0 && value.completedCount === value.totalCount && !value.skipped;
    value.state = !value.totalCount ? 'Rest' : value.skipped ? 'Skipped' : value.completed ? 'Completed' : value.ended ? value.completedCount ? 'PartiallyCompleted' : 'NotCompleted' :
      !value.occurrenceId ? plans.find(plan => plan.id === value.routineId)?.state === 'Paused' ? 'Paused' : 'Upcoming' : value.completedCount ? 'InProgress' : 'Ready';
    return value;
  };
  const session = (id: string, date: string | null) => {
    const today = currentDate(), target = date ?? today, key = id + ':' + target, p = plans.find(p => p.id === id); if (!p || target < p.startsOn) return null;
    const day = new Date(target + 'T12:00:00'), definition = p.days[(day.getDay() + 6) % 7];
    const boundary = new Date(target + 'T00:00:00'); boundary.setDate(boundary.getDate() + 1);
    if (!sessions.has(key)) sessions.set(key, { routineId: id, ...(definition.type === 'Exercises' && target <= today && p.state === 'Active' ? { occurrenceId: `routine-${id}-${target}` } : {}),
      title: p.title, notes: p.notes, mode: p.mode, minutes: p.minutes, sound: p.sound, vibration: p.vibration, date: target, revision: 1, ended: target < today,
      endsAtMs: boundary.getTime(), completedCount: 0, totalCount: definition.exercises.length, state: 'Ready', completed: false, skipped: false,
      steps: definition.exercises.map((exercise, index) => ({ ...exercise, completed: target <= today && index === 0 && !!options.progress })) });
    const saved = sessions.get(key)!;
    if (!saved.occurrenceId && definition.type === 'Exercises' && target <= today && p.state === 'Active') saved.occurrenceId = `routine-${id}-${target}`;
    return updateState(saved);
  };
  return {
    queryRoutines: async () => structuredClone(plans), getRoutineSession: async (id: string, date: string | null) => structuredClone(session(id, date)),
    queryRoutineHistory: async (id: string, cursor: string | null = null) => {
      const history = [...sessions.values()].map(updateState).filter(value => value.routineId === id && value.occurrenceId && (value.ended || value.completed || value.skipped)).sort((a, b) => b.date.localeCompare(a.date));
      const offset = Number(cursor ?? 0);
      return { items: structuredClone(history.slice(offset, offset + 50)), nextCursor: offset + 50 < history.length ? String(offset + 50) : null, total: history.length };
    },
    previewRoutine: async (input: Pick<RoutineDraft, 'mode' | 'minutes'> & Partial<Pick<RoutineDraft, 'days'>> & { startsOn?: string; routineId?: string }) => {
      const today = currentDate(), tomorrow = new Date(today + 'T00:00:00'); tomorrow.setDate(tomorrow.getDate() + 1);
      const effectiveDate = input.routineId ? civilAt(tomorrow.getTime()).slice(0, 10) : input.startsOn ?? today;
      const start = new Date((effectiveDate > today ? effectiveDate : today) + 'T00:00:00'), days = input.days ?? plan.days;
      let nextAlertMs: number | null = null;
      if (input.mode !== 'None') for (let offset = 0; offset < 14; offset++) {
        const next = new Date(start); next.setDate(next.getDate() + offset);
        next.setHours(Math.floor(input.minutes / 60), input.minutes % 60, 0, 0);
        if (days[(next.getDay() + 6) % 7].type === 'Exercises' && next.getTime() > Date.now()) { nextAlertMs = next.getTime(); break; }
      }
      return { today, effectiveDate, nextAlertMs };
    },
    progress: enabled ? session('weekly', null) : null,
    apply(command: Command): CommandResult | null {
      if (!['CreateRoutine', 'EditRoutine', 'PauseRoutine', 'ResumeRoutine', 'SetRoutineExercise', 'CorrectRoutineExercise', 'SkipRoutineDay', 'UndoSkipRoutineDay'].includes(command.kind)) return null;
      if (receipts.has(command.operationId)) return structuredClone(receipts.get(command.operationId)!);
      let result: CommandResult;
      if (command.kind === 'CreateRoutine' || command.kind === 'EditRoutine') {
        const p: RoutinePlan = command.kind === 'CreateRoutine' ? { notes: '', sound: 'remilo', vibration: false, ...command, id: 'weekly-' + plans.length, revision: 1, state: 'Active', effectiveDate: command.startsOn } : { ...plans.find(p => p.id === command.routineId)!, ...command, revision: command.expectedRevision + 1 };
        const index = plans.findIndex(row => row.id === p.id); if (index < 0) plans.push(p); else plans[index] = p;
        result = { status: 'Applied', routine: p };
      } else if (command.kind === 'PauseRoutine' || command.kind === 'ResumeRoutine') {
        const p = plans.find(p => p.id === command.routineId)!; p.state = command.kind === 'PauseRoutine' ? 'Paused' : 'Active'; p.revision++; result = { status: 'Applied', routine: p };
      } else if (command.kind === 'SetRoutineExercise' || command.kind === 'CorrectRoutineExercise' || command.kind === 'SkipRoutineDay' || command.kind === 'UndoSkipRoutineDay') {
        const s = [...sessions.values()].find(s => s.occurrenceId === command.occurrenceId);
        if (!s) return { status: 'Rejected', errorCode: 'NOT_FOUND' };
        updateState(s);
        if (command.date !== s.date) return { status: 'Rejected', errorCode: 'STALE_DATE' };
        if (command.expectedRevision !== s.revision) return { status: 'Rejected', errorCode: 'STALE_REVISION' };
        if (command.kind === 'CorrectRoutineExercise' ? !s.ended : s.ended) return { status: 'Rejected', errorCode: s.ended ? 'DAY_ENDED' : 'DAY_NOT_ENDED' };
        if (command.kind === 'SkipRoutineDay') { if (s.completed) return { status: 'Rejected', errorCode: 'NOT_ELIGIBLE' }; s.skipped = true; }
        else if (command.kind === 'UndoSkipRoutineDay') s.skipped = false;
        else if (command.kind === 'SetRoutineExercise' || command.kind === 'CorrectRoutineExercise') {
          const step = s.steps.find(e => e.id === command.stepId);
          if (!step || s.skipped && command.kind !== 'CorrectRoutineExercise') return { status: 'Rejected', errorCode: 'NOT_ELIGIBLE' };
          step.completed = !!command.completed;
        }
        else return null;
        s.revision++; updateState(s);
        result = { status: 'Applied', routineSession: structuredClone(s) };
      } else return null;
      receipts.set(command.operationId, structuredClone(result)); emit(); return structuredClone(result);
    },
  };
}
