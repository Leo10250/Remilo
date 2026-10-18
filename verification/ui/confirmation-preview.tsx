import { useState, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useTranslation } from '../../src/localization/react';
import { Button, Copy, Field, Page, Sheet } from '../../src/ui/components';
import { useAppearanceConfirmation } from '../../src/ui/confirmation';
import { ConfirmationHost } from '../../src/ui/confirmation-dialog';

/** Synthetic UI only. Uses the real host, confirmation hook, sheets and buttons. */
export function ConfirmationPreview({ children }: PropsWithChildren) {
  const [params] = useState(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search));
  return params.has('reviewConfirmation') ? <Fixture kind={params.get('reviewConfirmation')!} overSheet={params.get('reviewParent') === 'sheet'} /> : children;
}
function Fixture({ kind, overSheet }: { kind: string; overSheet: boolean }) {
  const t = useTranslation(), confirm = useAppearanceConfirmation();
  const [value, setValue] = useState('Front plank · 平板支撑'), [sheet, setSheet] = useState(overSheet), [result, setResult] = useState('');
  const open = () => {
    if (kind === 'info') { confirm(t('m_31442c166f10'), t('m_341b6b4fb929')); return; }
    if (kind === 'list' || kind === 'long') {
      confirm(t('m_0c08198f562b'), t('remove_list_confirmation', { name: kind === 'long' ? 'Weekly movement and rehabilitation exercises · 每周运动与康复训练清单' : value }),
        [{ text: t('m_19766ed6ccb2'), style: 'cancel' }, { text: t('m_669f24b0f91d'), style: 'destructive', onPress: () => setResult('Confirmed once') }]); return;
    }
    confirm(t('routine_child_discard_title'), t('routine_child_discard_hint'), [
      { text: t('m_e76fd2add010'), style: 'cancel' }, { text: t('m_eb1a70e39274'), style: 'destructive', onPress: () => setResult('Discarded once') },
    ]);
  };
  const form = <><Field label={t('routine_exercise_name')} value={value} onChangeText={setValue} />
    <Button label={t('routine_child_discard_title')} onPress={open} /><Copy>{result}</Copy></>;
  return <><Page compact title={t('routine_edit_exercise')} back={false}>
    {!overSheet && form}{overSheet && <Button label={t('routine_edit_exercise')} onPress={() => setSheet(true)} />}
  </Page><Sheet visible={sheet} title={t('routine_edit_exercise')} onClose={open}>
    <View style={{ gap: 12 }}>{form}</View>
  </Sheet><ConfirmationHost /></>;
}
