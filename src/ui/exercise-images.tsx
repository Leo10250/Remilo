import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, View } from 'react-native';
import type { ExercisePhoto, RoutineExercise } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { useTranslation } from '../localization/react';
import type { MessageKey } from '../localization/catalog.generated';
import { ActionFeedback, Button, Choice, ConnectedGroup, Copy, Icon, Sheet } from './components';
import { engine, nativeAvailable } from './native';
import { exerciseIllustrations, getExerciseIllustration } from './exercise-illustrations';
import { useTheme, useAppearanceHold } from './theme';

export function CustomExerciseImage({ id, name, large = false }: { id: string; name: string; large?: boolean }) {
  const t = useTranslation(), colors = useTheme();
  const photo = useQuery({ queryKey: ['exercise-image', id], queryFn: () => engine().getExerciseImage(id, null), enabled: nativeAvailable });
  return photo.data ? <Image source={{ uri: photo.data.uri }} resizeMode="contain" accessibilityLabel={t('routine_photo_for', { name })}
    style={{ width: '100%', height: large ? 400 : 180, backgroundColor: colors.soft, borderRadius: 16 }} /> :
    <ActionFeedback loading={photo.isLoading} message={photo.isLoading ? undefined : t('routine_image_unavailable')} tone="muted" />;
}

/** Keep unsaved parent images leased while nested editors come and go. */
export function useExerciseImageLeases(exercises: RoutineExercise[]) {
  const [owner] = useState(() => nativeAvailable ? engine().createOperationId() : 'preview');
  const ids = [...new Set(exercises.map(e => e.customImageId).filter((id): id is string => !!id))].sort().join(',');
  useEffect(() => {
    if (!nativeAvailable || !ids) return;
    const list = ids.split(','), renew = () => list.forEach(id => void engine().getExerciseImage(id, `${owner}:${id}`).catch(() => {}));
    renew(); const timer = setInterval(renew, 3_600_000);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') renew(); });
    return () => { clearInterval(timer); foreground.remove(); void engine().releaseExerciseImage(owner).catch(() => {}); };
  }, [ids, owner]);
}

export function ExerciseImageChooser({ exercise, onChange, onClose }: {
  exercise: RoutineExercise; onChange: (value: Partial<RoutineExercise>) => void; onClose: () => void;
}) {
  const t = useTranslation(), colors = useTheme(), live = useRef(true), running = useRef(false);
  const [candidate, setCandidate] = useState<ExercisePhoto | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<MessageKey | null>(null);
  useExerciseImageLeases([exercise, ...(candidate ? [{ ...exercise, customImageId: candidate.id }] : [])]);
  const leases = useRef<string[]>([]);
  useAppearanceHold(busy);
  useEffect(() => { live.current = true; const requests = leases.current; return () => { live.current = false; requests.forEach(lease => void engine().releaseExerciseImage(lease).catch(() => {})); }; }, []);
  const pick = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError(null);
    const request = engine().createOperationId(); leases.current.push(request);
    try { const photo = await engine().chooseExercisePhoto(request); if (live.current && photo) setCandidate(photo); else if (photo) void engine().releaseExerciseImage(request); }
    catch (reason) {
      const code = (reason as { code?: string })?.code?.replace(/^ERR_/, '');
      const messages: Record<string, MessageKey> = { IMAGE_SOURCE_TOO_LARGE: 'routine_photo_source_large', IMAGE_OUTPUT_TOO_LARGE: 'routine_photo_output_large', IMAGE_UNSUPPORTED: 'routine_photo_unsupported', IMAGE_UNREADABLE: 'routine_photo_unreadable', IMAGE_STORAGE_FULL: 'routine_photo_storage_full' };
      if (live.current) setError(messages[code ?? ''] ?? 'routine_photo_error');
    }
    finally { running.current = false; if (live.current) setBusy(false); }
  };
  const illustration = getExerciseIllustration(exercise.illustration);
  const apply = (value: Partial<RoutineExercise>) => { onChange(value); onClose(); };
  return <Sheet title={t('routine_illustration')} visible onClose={() => { if (!running.current) onClose(); }}>
    <Button label={t(exercise.customImageId ? 'routine_replace_photo' : 'routine_add_photo')} variant="secondary" busy={busy} disabled={!nativeAvailable} onPress={() => void pick()} />
    {error && <ActionFeedback message={t(error)} tone="danger" />}
    {exercise.customImageId ? <CustomExerciseImage id={exercise.customImageId} name={exercise.name} /> : illustration &&
      <Image source={illustration.source} resizeMode="contain" accessibilityLabel={t(illustration.descriptionKey)} style={{ width: '100%', height: 160, borderRadius: 16, backgroundColor: colors.soft }} />}
    <Copy muted size={14}>{t('routine_image_help')}</Copy>
    <ConnectedGroup>{exerciseIllustrations.map(entry => <Choice key={entry.id} label={t(entry.labelKey)} selected={!exercise.customImageId && exercise.illustration === entry.id} disabled={busy}
      thumbnail={<Image source={entry.source} resizeMode="contain" accessible={false} style={{ width: 64, height: 64 }} />}
      onPress={() => apply({ illustration: entry.id, customImageId: '' })} />)}</ConnectedGroup>
    {(exercise.illustration || exercise.customImageId) && <Button label={t('routine_remove_image')} variant="neutral" disabled={busy} onPress={() => apply({ illustration: '', customImageId: '' })} />}
    <Sheet title={t('routine_illustration')} visible={!!candidate} onClose={() => { if (!running.current) setCandidate(null); }}>
      {candidate && <Image source={{ uri: candidate.uri }} resizeMode="contain" accessibilityLabel={t('routine_photo_for', { name: exercise.name })} style={{ width: '100%', height: 320, backgroundColor: colors.soft, borderRadius: 16 }} />}
      <Button label={t('routine_use_photo')} disabled={busy || !candidate} onPress={() => { if (candidate) apply({ customImageId: candidate.id, illustration: '' }); }} />
      <Button label={t('routine_choose_another_photo')} variant="secondary" busy={busy} onPress={() => void pick()} />
    </Sheet>
  </Sheet>;
}

export function CustomExerciseImageFrame({ id, name, collapsed }: { id: string; name: string; collapsed: boolean }) {
  const t = useTranslation(), [open, setOpen] = useState(false);
  return <>{collapsed ? <Button label={t('routine_view_image')} variant="neutral" onPress={() => setOpen(true)} /> :
    <Pressable style={{ width: '100%', maxWidth: 320, alignSelf: 'center' }} accessibilityRole="button" accessibilityLabel={t('routine_photo_for', { name })} accessibilityHint={t('routine_view_image')} onPress={() => setOpen(true)}>
      <CustomExerciseImage id={id} name={name} />
      <View accessible={false} style={{ position: 'absolute', top: 8, right: 8 }}><Icon name="open_in_new" size={20} /></View>
    </Pressable>}
    <Sheet title={t('routine_photo_for', { name })} visible={open} onClose={() => setOpen(false)}><CustomExerciseImage id={id} name={name} large /></Sheet>
  </>;
}
