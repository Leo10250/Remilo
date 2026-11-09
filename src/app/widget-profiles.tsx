import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import type { WidgetProfile } from '../../modules/remilo-alarm/src/RemiloAlarm.types';
import { CapturedOperation } from '../domain/operation';
import { errorText } from '../localization';
import { useLocalizedState, useTranslation } from '../localization/react';
import {
  ActionFeedback,
  Button,
  Choice,
  ConnectedGroup,
  Copy,
  Field,
  Page,
  QueryState,
  SectionStack,
  SettingRow,
} from '../ui/components';
import { useAppearanceConfirmation } from '../ui/confirmation';
import { engine, nativeAvailable } from '../ui/native';
import { useWidgetProfileSupport } from '../ui/widget-setup';

type Write = { kind: 'save' | 'remove'; profile: WidgetProfile };

function code(error: unknown) {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
}

export default function WidgetProfiles() {
  'use no memo';
  const t = useTranslation();
  const client = useQueryClient();
  const confirm = useAppearanceConfirmation();
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  const support = useWidgetProfileSupport();
  const profiles = useQuery({
    queryKey: ['widget-profiles'],
    queryFn: () => engine().getWidgetProfiles!(),
    enabled: support.data === true,
  });
  const routines = useQuery({
    queryKey: ['routines'],
    queryFn: () => engine().queryRoutines(),
    enabled: support.data === true,
  });
  const [draft, setDraft] = useState<WidgetProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useLocalizedState('');
  const running = useRef(false);
  const [operation] = useState(
    () =>
      new CapturedOperation<Write, void>(
        async ({ kind, profile }) => {
          const module = engine();
          if (kind === 'remove') await module.removeWidgetProfile!(profile.id, profile.revision);
          else
            await module.saveWidgetProfile!(
              profile.id,
              profile.title,
              profile.routineId,
              profile.revision,
            );
        },
        (error) =>
          [
            'INVALID_INPUT',
            'NOT_FOUND',
            'NOT_ELIGIBLE',
            'STALE_REVISION',
            'UNSUPPORTED',
            'WIDGET_ACTION_PENDING',
          ].includes(code(error)),
      ),
  );
  const guarded = busy || operation.pending;
  const closeEditor = () => {
    if (guarded) return;
    setDraft(null);
    setFeedback('');
  };
  usePreventRemove(guarded || draft !== null, closeEditor);
  const back = () => {
    if (guarded) return;
    if (draft) closeEditor();
    else if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };
  const reload = () => {
    void support.refetch();
    if (support.data) {
      void profiles.refetch();
      void routines.refetch();
    }
  };
  const execute = async (write: Write) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setFeedback('');
    try {
      await operation.run(write);
      setDraft(null);
    } catch (error) {
      setFeedback(
        code(error) === 'WIDGET_ACTION_PENDING'
          ? t('ios_widget_profile_pending')
          : errorText(error, t(operation.pending ? 'm_df24f6cb25c5' : 'm_45e0434567cb')),
      );
      if (code(error) === 'STALE_REVISION') setDraft(null);
    } finally {
      running.current = false;
      setBusy(false);
      void client.invalidateQueries({ queryKey: ['widget-profiles'] });
    }
  };
  const choices = routines.data ?? [];
  const current = profiles.data?.find((profile) => profile.id === draft?.id);
  const saved = current?.revision === draft?.revision ? current : undefined;
  const pending = current?.hasPending ?? draft?.hasPending ?? false;
  const selected = choices.find((routine) => routine.id === draft?.routineId);
  const create = () => {
    const routine = choices.find((choice) => choice.id === routineId) ?? choices[0];
    if (!routine) return;
    setFeedback('');
    setDraft({
      id: engine().createOperationId(),
      title: '',
      routineId: routine.id,
      revision: 0,
      hasPending: false,
    });
  };
  const edit = (profile: WidgetProfile) => {
    setFeedback('');
    setDraft(profile);
  };
  const remove = (profile: WidgetProfile) =>
    confirm(
      t('ios_widget_remove_profile'),
      t('ios_widget_remove_profile_detail', { name: profile.title }),
      [
        { text: t('m_19766ed6ccb2'), style: 'cancel' },
        {
          text: t('ios_widget_remove_profile'),
          style: 'destructive',
          onPress: () => void execute({ kind: 'remove', profile }),
        },
      ],
    );

  return (
    <Page
      title={t(
        draft
          ? draft.revision
            ? 'ios_widget_edit_profile'
            : 'ios_widget_new_profile'
          : 'ios_widget_profiles',
      )}
      onBack={back}
    >
      <SectionStack>
        <QueryState
          loading={
            support.isLoading ||
            (support.data === true && (profiles.isLoading || routines.isLoading))
          }
          error={support.error ?? profiles.error ?? routines.error}
          empty={!nativeAvailable || (support.isSuccess && !support.data)}
          emptyMessage={t('ios_widget_profile_unavailable')}
          onRetry={reload}
        />
        {support.data &&
          profiles.data &&
          routines.data &&
          (draft ? (
            <>
              <Field
                label={t('ios_widget_profile_name')}
                value={draft.title}
                editable={!guarded && !pending}
                maxLength={120}
                required
                onChangeText={(title) => setDraft({ ...draft, title })}
              />
              <ConnectedGroup title={t('widget_choose_routine')}>
                {!selected && <Copy muted>{t('widget_unavailable')}</Copy>}
                {choices.map((routine) => (
                  <Choice
                    key={routine.id}
                    label={routine.title}
                    selected={routine.id === draft.routineId}
                    disabled={guarded || pending}
                    onPress={() => setDraft({ ...draft, routineId: routine.id })}
                  />
                ))}
              </ConnectedGroup>
              {pending && (
                <ActionFeedback tone="warning" message={t('ios_widget_profile_pending')} />
              )}
              <Button
                label={t('m_1509f561f241')}
                disabled={guarded || pending || !selected || !draft.title.trim()}
                onPress={() => void execute({ kind: 'save', profile: draft })}
              />
              {draft.revision > 0 && (
                <Button
                  label={t('ios_widget_remove_profile')}
                  variant="danger"
                  disabled={guarded || !saved}
                  onPress={() => {
                    if (saved) remove(saved);
                  }}
                />
              )}
            </>
          ) : (
            <>
              <Copy muted>{t('ios_widget_profile_setup')}</Copy>
              <Copy muted>{t('ios_widget_profile_history')}</Copy>
              {profiles.data.length > 0 && (
                <ConnectedGroup>
                  {profiles.data.map((profile) => (
                    <SettingRow
                      key={profile.id}
                      intent="navigation"
                      label={profile.title}
                      description={
                        choices.find((routine) => routine.id === profile.routineId)?.title ??
                        t('widget_unavailable')
                      }
                      onPress={() => edit(profile)}
                    />
                  ))}
                </ConnectedGroup>
              )}
              <Button
                label={t('ios_widget_new_profile')}
                disabled={!choices.length}
                onPress={create}
              />
              {!choices.length && <Copy muted>{t('widget_create_hint')}</Copy>}
            </>
          ))}
        {(busy || feedback) && <ActionFeedback loading={busy} message={feedback} tone="warning" />}
        {operation.captured && !busy && (
          <Button
            label={t('widget_retry_same_action')}
            variant="secondary"
            onPress={() => void execute(operation.captured!)}
          />
        )}
      </SectionStack>
    </Page>
  );
}
