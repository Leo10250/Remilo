import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import type { ReminderDraft, SoundPreviewSnapshot } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { ActionFeedback, Choice, Copy, IconButton, SettingRow, Sheet } from './components';
import { engine, nativeAvailable } from './native';

type Sound = NonNullable<ReminderDraft['sound']>;
type Preview = SoundPreviewSnapshot;
const label = (sound: Sound) => sound === 'system' ? 'System alarm' : 'Remilo';
function reasonMessage(reason?: string) {
  return ({ AlarmActive: 'An alarm is ringing. Try preview after it stops.',
    SyntheticPreview: 'Sound playback is available in the Android app. This fixture does not play audio.',
    Background: 'Preview stopped when Remilo left the foreground.',
    Interrupted: 'Preview was interrupted. Tap Play to try again.',
    Replaced: 'A different sound preview started.',
    Failed: 'Could not play this sound. Check alarm volume and tap Play to retry.',
    TimedOut: 'Preview ended.', Stopped: 'Preview stopped.' } as Record<string, string>)[reason ?? ''] ?? 'Could not play this sound. Tap Play to retry.';
}

function useSoundPreview(visible: boolean) {
  const [preview, setPreview] = useState<Preview | null>(null), [error, setError] = useState(''), [stopping, setStopping] = useState(false);
  const request = useRef<string | null>(null), live = useRef(false);
  const stop = async () => {
    const id = request.current;
    if (!id) return;
    setStopping(true); setError('');
    try {
      await engine().stopSoundPreview(id);
      if (live.current && request.current === id) setPreview((old) => old?.requestId === id ? { ...old, state: 'Ended' } : old);
    } catch { if (live.current && request.current === id) setError('Could not stop the preview. Tap Stop to retry.'); }
    finally { if (live.current) setStopping(false); }
  };
  useEffect(() => {
    if (!visible || !nativeAvailable) return;
    live.current = true;
    let revision = 0;
    const listener = engine().addListener('onSoundPreviewState', (value) => {
      revision++;
      if (live.current && value.requestId === request.current) setPreview(value as Preview);
    });
    const ticket = revision;
    void engine().getSoundPreview().then((value) => {
      if (live.current && revision === ticket && value?.requestId === request.current) setPreview(value as Preview);
    }).catch(() => { if (live.current) setError('Could not check preview playback. Try Play again.'); });
    const background = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && request.current) void engine().stopSoundPreview(request.current).catch(() => {});
    });
    return () => {
      live.current = false; listener.remove(); background.remove();
      if (request.current) void engine().stopSoundPreview(request.current).catch(() => {});
    };
  }, [visible]);
  const play = async (sound: Sound) => {
    const id = engine().createOperationId(); request.current = id;
    setError(''); setStopping(false); setPreview({ requestId: id, sound, state: 'Starting' });
    try {
      const result = await engine().previewSound(sound, id);
      if (live.current && request.current === id) setPreview((old) => old?.requestId === id && old.state === 'Starting' ? result as Preview : old);
    } catch (failure) {
      if (live.current && request.current === id) setPreview({ requestId: id, sound, state: 'Failed', reason: failure instanceof Error ? failure.message : 'Could not play this sound. Try Play again.' });
    }
  };
  return { preview, error, stopping, play, stop };
}

/** Selection changes the caller's draft/default; preview never commits a selection. */
export function SoundPicker({ value, onChange, disabled = false }: { value: Sound; onChange: (sound: Sound) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const playback = useSoundPreview(open);
  const playing = !!playback.preview && ['Starting', 'Playing'].includes(playback.preview.state);
  const close = () => { void playback.stop(); setOpen(false); };
  const preview = playback.preview;
  const message = playback.error || (playback.stopping ? 'Stopping preview…' : preview?.state === 'Starting' ? 'Starting sound preview…' :
    preview?.state === 'Playing' ? `${label(preview.actualSound ?? preview.sound)} preview playing${preview.actualSound && preview.actualSound !== preview.sound ? ' · System tone unavailable; using Remilo.' : '.'}` :
    preview?.state === 'Failed' ? reasonMessage(preview.reason) :
    preview?.state === 'Interrupted' ? reasonMessage(preview.reason ?? 'Interrupted') : preview?.state === 'Ended' ? reasonMessage(preview.reason ?? 'TimedOut') : '');
  return <><SettingRow label="Sound" icon="volume_up" value={label(value)} disabled={disabled} onPress={() => setOpen(true)} />
    <Sheet title="Alarm sound" visible={open} onClose={close}>
      <Copy muted>Choose a sound, or use Play to listen before choosing.</Copy>
      {(['remilo', 'system'] as const).map((sound) => {
        const active = playing && preview?.sound === sound;
        return <View key={sound} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Choice label={label(sound)} selected={value === sound} onPress={() => { onChange(sound); close(); }} /></View>
          <IconButton icon={active ? 'stop' : 'play_arrow'} label={(active ? 'Stop ' : 'Play ') + label(sound) + ' preview'}
            disabled={!nativeAvailable || playback.stopping} onPress={() => void (active ? playback.stop() : playback.play(sound))} />
        </View>;
      })}
      <ActionFeedback message={message} loading={preview?.state === 'Starting' || playback.stopping}
        tone={playback.error || preview?.state === 'Failed' ? 'danger' : preview?.state === 'Interrupted' ? 'warning' : 'muted'} />
      <Copy muted size={13}>Preview ends after five seconds. A ringing alarm takes priority.</Copy>
    </Sheet></>;
}
