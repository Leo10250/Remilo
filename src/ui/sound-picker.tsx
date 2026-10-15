import { useLocalizedState, useTranslation } from '../localization/react';
import { t } from '../localization';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import type { ReminderDraft, SoundPreviewSnapshot } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { ActionFeedback, Choice, Copy, IconButton, SettingRow, Sheet } from './components';
import { engine, nativeAvailable } from './native';

type Sound = NonNullable<ReminderDraft['sound']>;
type Preview = SoundPreviewSnapshot;
const label = (sound: Sound) => sound === 'system' ? t('m_6a05d9e751b1') : 'Remilo';
function reasonMessage(reason?: string) {
  return ({ AlarmActive: t('m_18a398f277d0'),
    SyntheticPreview: t('m_be80fceafe68'),
    Background: t('m_5de1e088be7c'),
    Interrupted: t('m_4fe300e920d5'),
    Replaced: t('m_42cb54a05be4'),
    Failed: t('m_9b18a4fe3f26'),
    TimedOut: t('m_5248d26f7160'), Stopped: t('m_b8e649eb36e4') } as Record<string, string>)[reason ?? ''] ?? t('m_abb6151f1947');
}

function useSoundPreview(visible: boolean) {
  const [preview, setPreview] = useState<Preview | null>(null), [error, setError] = useLocalizedState(''), [stopping, setStopping] = useState(false);
  const request = useRef<string | null>(null), live = useRef(false);
  const stop = async () => {
    const id = request.current;
    if (!id) return;
    setStopping(true); setError('');
    try {
      await engine().stopSoundPreview(id);
      if (live.current && request.current === id) setPreview((old) => old?.requestId === id ? { ...old, state: 'Ended' } : old);
    } catch { if (live.current && request.current === id) setError(t('m_a8195dbb6865')); }
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
    }).catch(() => { if (live.current) setError(t('m_f97c2f09ab98')); });
    const background = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && request.current) void engine().stopSoundPreview(request.current).catch(() => {});
    });
    return () => {
      live.current = false; listener.remove(); background.remove();
      if (request.current) void engine().stopSoundPreview(request.current).catch(() => {});
    };
  }, [visible, setError]);
  const play = async (sound: Sound) => {
    const id = engine().createOperationId(); request.current = id;
    setError(''); setStopping(false); setPreview({ requestId: id, sound, state: 'Starting' });
    try {
      const result = await engine().previewSound(sound, id);
      if (live.current && request.current === id) setPreview((old) => old?.requestId === id && old.state === 'Starting' ? result as Preview : old);
    } catch (failure) {
      if (live.current && request.current === id) setPreview({ requestId: id, sound, state: 'Failed', reason: failure instanceof Error ? failure.message : t('m_a49e7228975b') });
    }
  };
  return { preview, error, stopping, play, stop };
}

/** Selection changes the caller's draft/default; preview never commits a selection. */
export function SoundPicker({ value, onChange, disabled = false }: { value: Sound; onChange: (sound: Sound) => void; disabled?: boolean }) {
  'use no memo';
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const playback = useSoundPreview(open);
  const playing = !!playback.preview && ['Starting', 'Playing'].includes(playback.preview.state);
  const close = () => { void playback.stop(); setOpen(false); };
  const preview = playback.preview;
  const message = playback.error || (playback.stopping ? t('m_c0f07d1b133a') : preview?.state === 'Starting' ? t('m_cf1643777ec3') :
    preview?.state === 'Playing' ? t('m_94a0f98c0984', { arg0: String(label(preview.actualSound ?? preview.sound)), arg1: String(preview.actualSound && preview.actualSound !== preview.sound ? t('m_c9d0e41b38a5') : '.') }) :
    preview?.state === 'Failed' ? reasonMessage(preview.reason) :
    preview?.state === 'Interrupted' ? reasonMessage(preview.reason ?? t('m_132d124d6bb3')) : preview?.state === 'Ended' ? reasonMessage(preview.reason ?? t('m_99df459b70fb')) : '');
  return <><SettingRow label={t('m_46124e023603')} icon="volume_up" value={label(value)} disabled={disabled} onPress={() => setOpen(true)} />
    <Sheet title={t('m_0fb95a89117b')} visible={open} onClose={close}>
      <Copy muted>{t('m_2dd2503b3307')}</Copy>
      {(['remilo', 'system'] as const).map((sound) => {
        const active = playing && preview?.sound === sound;
        return <View key={sound} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Choice label={label(sound)} selected={value === sound} onPress={() => { onChange(sound); close(); }} /></View>
          <IconButton icon={active ? 'stop' : 'play_arrow'} label={(active ? t('m_366e0f21b8af') : t('m_a1e923026def')) + label(sound) + t('m_0025da04e552')}
            disabled={!nativeAvailable || playback.stopping} onPress={() => void (active ? playback.stop() : playback.play(sound))} />
        </View>;
      })}
      <ActionFeedback message={message} loading={preview?.state === 'Starting' || playback.stopping}
        tone={playback.error || preview?.state === 'Failed' ? 'danger' : preview?.state === 'Interrupted' ? 'warning' : 'muted'} />
      <Copy muted size={13}>{t('m_522cc5477bfb')}</Copy>
    </Sheet></>;
}
