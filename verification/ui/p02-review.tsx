/** Opt-in browser host fixtures. Actual shared components; memory-only callbacks. */
import { createElement, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionFeedback, AppBar, Button, Card, Choice, Copy, Field, Group, Heading, IconButton, SettingRow, Sheet, Snackbar, Status, Toggle } from '../../src/ui/components';
import { ReminderRow } from '../../src/ui/reminder-row';
import { FoundationStyleProvider, PresentationStateProvider, ReviewThemeProvider } from '../../src/ui/theme';
import { lookupFoundation, sceneryFallback } from '../../src/ui/foundations/foundation';
import { foundationCatalog } from '../../src/ui/foundations/catalog.generated';
import { p02Assets } from './p02-assets.generated';
import { reviewItems, reviewNowMs } from './design-review-fixtures';

export default function P02Review() {
  const q = useLocalSearchParams<Record<string, string>>();
  const width = Number(q.width) || 360, height = Number(q.height) || 800, scale = q.scale === '2' ? 2 : 1;
  const mode = q.mode ?? 'browsing', content = q.content ?? 'standard';
  const [failed, setFailed] = useState(false), [feedback, setFeedback] = useState(''), [sheet, setSheet] = useState(q.sheet === '1');
  const [checked, setChecked] = useState(true);
  const scroll = useRef<ScrollView>(null);
  const invalid = q.invalid === '1' ? {...foundationCatalog, palettes:foundationCatalog.palettes.map(p => p.id === q.palette ? {...p,colors:{light:{ink:'invalid'},dark:{ink:'invalid'}}} : p)} : foundationCatalog;
  const requested = lookupFoundation(q.palette ?? 'sky',q.brightness === 'dark' ? 'dark' : 'light',invalid);
  const f = failed || q.missing === '1' ? sceneryFallback(requested) : requested;
  const c = f.colors, scene = f.scene, placement = scene?.[mode === 'individual' ? 'individual' : 'browsing'];
  const sceneryHeight = placement ? Math.min(height * placement.heightFraction,width * (placement.edge === 'top' ? 1.5 : 2/3)) : 0;
  const asset = scene && foundationCatalog.assets.find(a => a.id === scene.assetId);
  const imageScale = asset ? Math.max(width / asset.width, sceneryHeight / asset.height) : 0;
  const imageWidth = asset ? asset.width * imageScale : 0, imageHeight = asset ? asset.height * imageScale : 0;
  const title = content === 'chinese' ? '整理项目评审需要的演示文稿、客户反馈和下一阶段的详细计划' : content === 'english' ? 'Prepare the complete presentation and supporting notes for the upcoming project review with the regional team' : f.id === 'rose' ? 'Water the roses' : 'Plan a quiet afternoon';
  const callback = (action:string) => () => setFeedback('Review action: '+action+'. No reminder was changed.');
  const items = reviewItems(content === 'english' ? 'p01-long-english' : content === 'chinese' ? 'p01-long-chinese' : 'populated').slice(0,4);
  return <View style={{ minHeight:height,backgroundColor:'#EDF0F3',alignItems:'center' }}>
    {q.background === '1' && createElement('style', {}, '[data-testid="p02-canvas"] * { color:transparent!important; text-shadow:none!important; caret-color:transparent!important } [data-testid="p02-canvas"] svg * { fill:transparent!important; stroke:transparent!important }')}
    <ReviewThemeProvider colors={c} fontScale={scale} reducedMotion={q.motion === 'reduced'}>
      <FoundationStyleProvider foundation={f}>
        <View testID="p02-canvas" accessibilityLabel={`P02 ${f.id} ${mode}; ${f.fallback}`} style={{width,height,backgroundColor:c.background,overflow:'hidden'}}>
          {scene && placement && <View pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill,{justifyContent:placement.edge === 'top' ? 'flex-start' : 'flex-end'}]}>
            <View style={{width:'100%',height:sceneryHeight,overflow:'hidden'}}><Image accessible={false} source={p02Assets[scene.assetId]} onError={() => setFailed(true)} resizeMode="stretch"
              style={{position:'absolute',width:imageWidth,height:imageHeight,left:(width-imageWidth)*placement.anchor[0],top:(sceneryHeight-imageHeight)*placement.anchor[1]}} /></View>
          </View>}
          <AppBar title={mode === 'browsing' ? 'Agenda' : mode === 'primitives' ? 'Shared controls' : 'Reminder'} back={false}
            actions={<IconButton icon="more_vert" label="Open sample options" onPress={() => setSheet(true)} />} />
          <ScrollView ref={scroll} testID="p02-scroll" keyboardShouldPersistTaps="handled"
            // Stay 24 dp before the physical edge: browser scroll clamping rounds
            // fractional CJK line boxes differently when text is transparent.
            // Every bottom action remains visible; original/background use one y.
            onContentSizeChange={(_, contentHeight) => { if(q.offset) scroll.current?.scrollTo({y:Math.max(0,Number(q.offset)||0),animated:false}); else if(q.scroll === 'end') scroll.current?.scrollTo({y:Math.max(0,Math.floor(contentHeight-height+32)),animated:false}); else if(q.scroll === 'middle') scroll.current?.scrollTo({y:Math.round(Math.max(0,(contentHeight-height)/2)),animated:false}); }}
            contentContainerStyle={{padding:16,gap:16,alignSelf:'center',width:'100%',maxWidth:mode === 'browsing' ? 560 : 480,paddingBottom:32}}>
            {mode === 'browsing' ? <>
              <Card><Copy muted size={14}>Tuesday, October 6</Copy><Heading>Today</Heading></Card>
              {items.map(item => <ReminderRow key={item.id} item={item} presentation="tile" reviewNow={reviewNowMs} onOpen={callback('Open')} onDone={callback('Done')} />)}
              <Button label={content === 'chinese' ? '添加提醒' : 'Add reminder'} icon="add" onPress={callback('Add')} />
            </> : mode === 'individual' ? <>
              <View style={{backgroundColor:c.surface,borderRadius:16,padding:16,gap:12}}>
                <Copy muted size={14}>Personal</Copy><Text accessibilityRole="header" style={{fontSize:28*scale,lineHeight:28*scale*1.4,fontWeight:'600',color:c.ink}}>{title}</Text>
                <Copy size={22}>8:00 AM</Copy><Copy muted size={14}>Event 10:00 AM · Due 9:00 AM</Copy>
                <Status label="Stopped · still unfinished" tone="warning" icon="stop" />
                <Copy>{content === 'chinese' ? '保留独立的事件、截止时间和提醒时间。检查资料后再决定下一步。' : 'Keep the event, Due and next alert distinct. Review the notes before choosing what happens next.'}</Copy>
              </View>
              <Group title="Current delivery"><SettingRow label="Next alert" value="Today, 6:00 PM" icon="alarm" onPress={() => setSheet(true)} description="Postponed from 9:00 AM" /></Group>
              <Button label={content === 'chinese' ? '完成此提醒' : 'Mark done'} icon="check" onPress={callback('Done')} />
              <Button label={content === 'chinese' ? '稍后再提醒' : 'Postpone'} variant="secondary" icon="schedule" onPress={() => setSheet(true)} />
            </> : <>
              <Card><Heading>Typography</Heading><Copy size={28} heading>{title}</Copy><Copy size={22}>8:00 AM</Copy><Heading>Supporting information</Heading><Copy>Body · 16 sp</Copy><Copy muted size={14}>Due 9:00 AM · still unfinished</Copy><Copy muted size={12}>Minor metadata · 12 sp</Copy></Card>
              <Card><Heading>Control states</Heading>
                <Button label="Default" icon="check" onPress={callback('Default')} />
                <PresentationStateProvider state="pressed"><Button label="Pressed" icon="check" onPress={callback('Pressed')} /></PresentationStateProvider>
                <PresentationStateProvider state="focused"><Button label="Focused" variant="secondary" icon="check" onPress={callback('Focused')} /></PresentationStateProvider>
                <Choice label="Selected option" selected={checked} onPress={() => setChecked(!checked)} />
                <Choice label="Unselected option" selected={!checked} onPress={() => setChecked(!checked)} />
                <Button label="Disabled" disabled icon="check" onPress={callback('Disabled')} />
                <Button label="Saving…" busy icon="check" onPress={callback('Saving')} />
                <Button label="Remove" variant="danger" icon="delete" onPress={callback('Remove')} />
                <Field label="Reminder title" value={title} multiline onChangeText={() => {}} />
                <Field label="Time" value="8:00 AM" error="Choose a future time." onChangeText={() => {}} />
                <Toggle label="Use vibration" value={checked} onChange={setChecked} icon="vibration" />
                <ActionFeedback tone="danger" message="Could not save. Your draft is retained." />
                <Button label="Retry" variant="secondary" icon="refresh" onPress={callback('Retry')} />
              </Card>
              <Card><Heading>Consequential information</Heading><Status label="Due 9:00 AM" tone="muted" icon="schedule" /><Status label="Overdue · still unfinished" tone="danger" icon="warning" /><Status label="Stopped" tone="warning" icon="stop" /><Status label="Changed · next alert 6:00 PM" tone="success" icon="alarm" /></Card>
            </>}
            {!!feedback && <ActionFeedback message={feedback} />}
          </ScrollView>
          <Sheet title="Postpone reminder" visible={sheet} onClose={() => setSheet(false)}><Copy>Choose the next alert time.</Copy><Choice label="Today, 6:00 PM" selected onPress={() => setSheet(false)} /><Button label="Apply" icon="check" onPress={() => setSheet(false)} /></Sheet>
          {q.snackbar === '1' && <Snackbar persistent message="Reminder updated." action="View" onAction={callback('View')} onClose={callback('Dismiss')} />}
        </View>
      </FoundationStyleProvider>
    </ReviewThemeProvider>
  </View>;
}
