/** Memory-only routine fixture for actual component review. Never bundled on Android. */
import type { Command, CommandResult, RoutineDay, RoutinePlan, RoutineSession } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { civilAt } from '../../src/domain/time';

export const workoutWeek: RoutineDay[] = [
  ['Bird-dog|3×10', 'Front plank|3×40s', 'Side plank|3×25s/side', 'Intervals|8×(1 min fast / 1 min slow)'],
  ['Incline walk|35 min @ 6–8%'],
  ['Lat pulldown|100lb 3×10', 'Chest press|80lb 3×10', 'Face pull|17.5lb 3×12–15', 'Shoulder press|40lb 3×10', 'Incline hammer curl|20lb 3×10', 'Tricep pulldown|32lb 3×10–12', 'Easy jog|10 min'],
  ['Bird-dog|3×10', 'Front plank|3×30s', 'Easy walk|30 min'],
  ['Goblet squat|35lb 3×10', 'DB bench|30lb 3×10', 'DB RDL|25lb 3×10', '1-arm row|3×10', 'Easy walk|30 min'],
  ['Long walk|60 min'], [],
].map((exercises, day) => ({ type: exercises.length ? 'Exercises' : 'Rest', exercises: exercises.map((value, index) => ({ id: `exercise-${day}-${index}`, name: value.split('|')[0], target: value.split('|')[1], notes: '', illustration: '' })) }));

export function routinePreview(enabled: boolean, emit: () => void) {
  const today = civilAt(Date.now()).slice(0, 10), tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
  const plan: RoutinePlan = { id: 'weekly', title: 'Weekly workout', revision: 1, state: 'Active', startsOn: today, effectiveDate: today, minutes: 540, mode: 'Notification', listId: null, days: workoutWeek };
  const plans: RoutinePlan[] = enabled ? [plan] : [];
  const sessions = new Map<string, RoutineSession>(), receipts = new Map<string, CommandResult>();
  const session = (id: string, date: string | null) => {
    const target = date ?? today, key = id + target, p = plans.find(p => p.id === id); if (!p) return null;
    if (!sessions.has(key)) sessions.set(key, { routineId: id, occurrenceId: `routine-${id}-${target}`, title: p.title, date: target, revision: 1, ended: target < today,
      endsAtMs: tomorrow.getTime(), completedCount: 0, totalCount: 4, state: 'Ready', completed: false, skipped: false,
      steps: p.days[0].exercises.map(e => ({ ...e, completed: false })) });
    return sessions.get(key)!;
  };
  return {
    queryRoutines: async () => structuredClone(plans), getRoutineSession: async (id: string, date: string | null) => structuredClone(session(id, date)),
    queryRoutineHistory: async (id: string) => ({ items: structuredClone([...sessions.values()].filter(s => s.routineId === id && (s.ended || s.completed || s.skipped))), nextCursor: null, total: 0 }),
    previewRoutine: async (input: { mode: string; minutes: number }) => ({ today, effectiveDate: civilAt(tomorrow.getTime()).slice(0, 10), nextAlertMs: input.mode === 'None' ? null : tomorrow.getTime() + input.minutes * 60000 }),
    progress: enabled ? session('weekly', null) : null,
    apply(command: Command): CommandResult | null {
      if (!['CreateRoutine', 'EditRoutine', 'PauseRoutine', 'ResumeRoutine', 'SetRoutineExercise', 'CorrectRoutineExercise', 'SkipRoutineDay', 'UndoSkipRoutineDay'].includes(command.kind)) return null;
      if (receipts.has(command.operationId)) return structuredClone(receipts.get(command.operationId)!);
      let result: CommandResult;
      if (command.kind === 'CreateRoutine' || command.kind === 'EditRoutine') {
        const p: RoutinePlan = command.kind === 'CreateRoutine' ? { ...command, id: 'weekly-' + plans.length, revision: 1, state: 'Active', effectiveDate: command.startsOn } : { ...plans.find(p => p.id === command.routineId)!, ...command, revision: command.expectedRevision + 1 };
        const index = plans.findIndex(row => row.id === p.id); if (index < 0) plans.push(p); else plans[index] = p;
        result = { status: 'Applied', routine: p };
      } else if (command.kind === 'PauseRoutine' || command.kind === 'ResumeRoutine') {
        const p = plans.find(p => p.id === command.routineId)!; p.state = command.kind === 'PauseRoutine' ? 'Paused' : 'Active'; p.revision++; result = { status: 'Applied', routine: p };
      } else if ('occurrenceId' in command && 'date' in command) {
        const s = [...sessions.values()].find(s => s.occurrenceId === command.occurrenceId)!;
        if (command.kind === 'SkipRoutineDay') s.skipped = true;
        else if (command.kind === 'UndoSkipRoutineDay') s.skipped = false;
        else { const step = s.steps.find(e => e.id === command.stepId)!; step.completed = !!command.completed; }
        s.revision++; s.completedCount = s.steps.filter(e => e.completed).length; s.completed = s.completedCount === s.steps.length;
        s.state = s.skipped ? 'Skipped' : s.completed ? 'Completed' : s.completedCount ? 'InProgress' : 'Ready';
        result = { status: 'Applied', routineSession: structuredClone(s) };
      } else return null;
      receipts.set(command.operationId, structuredClone(result)); emit(); return structuredClone(result);
    },
  };
}
