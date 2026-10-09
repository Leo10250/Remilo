import { requireNativeView } from 'expo';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type NativeSyntheticEvent, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { readRootSnapshot, writeRootSnapshot } from '../domain/navigation';
import { revealRange } from '../domain/form-geometry';
import { useReducedMotion } from './motion';
type Geometry = { imeVisible: boolean; overlap: number; field: number; hasCaret: boolean; caretTop: number; caretBottom: number; hasViewport: boolean; viewportTop: number; viewportHeight: number; viewportScrollY: number; shouldReveal: boolean };
const NativeGeometry = Platform.OS === 'android' ? requireNativeView<ViewProps & { onGeometry: (event: NativeSyntheticEvent<Geometry>) => void }>('RemiloFormGeometry') : null;
const FormFocus = createContext<(top: number, bottom: number) => void>(() => {});
export const useRevealInput = () => useContext(FormFocus);
/** Shared usable region for forms and custom virtualized pages such as search. */
export function WindowGeometryRegion({children,onGeometry,fill=true}:PropsWithChildren<{onGeometry?:(data:Geometry)=>void;fill?:boolean}>) {
  const insets=useSafeAreaInsets(),[geometry,setGeometry]=useState({imeVisible:false,overlap:0});
  return <View collapsable={false} style={{...(fill?{flex:1}:{flexShrink:1}),paddingBottom:geometry.imeVisible?geometry.overlap:insets.bottom}}>
    {NativeGeometry && <NativeGeometry pointerEvents="none" style={StyleSheet.absoluteFill} onGeometry={event=>{
      const data=event.nativeEvent;
      setGeometry(previous=>previous.imeVisible===data.imeVisible && previous.overlap===data.overlap?previous:{imeVisible:data.imeVisible,overlap:data.overlap});
      onGeometry?.(data);
    }}/>}{children}
  </View>;
}
export function FormViewport({ children, footer, scrollKey, scrollReady = true, fill = true, contentStyle }: PropsWithChildren<{
  footer?: ReactNode; scrollKey?: string; scrollReady?: boolean; fill?: boolean; contentStyle?: ViewProps['style'];
}>) {
  const scroll = useRef<ScrollView>(null), offset = useRef(0), content = useRef(0), viewport = useRef({top:0,height:0});
  const restored = useRef(false), reduced = useReducedMotion();
  const latestGeometry = useRef<Geometry | null>(null);
  const measure = useCallback((after?: () => void) => scroll.current?.getNativeScrollRef()?.measureInWindow((_x: number,y: number,_width: number,height: number) => { viewport.current={top:y,height};after?.(); }),[]);
  const reveal = useCallback((top: number, bottom: number) => {
    const {top: start,height}=viewport.current;
    if (!height) return;
    const y=revealRange(top,bottom,start,height,offset.current,content.current);
    if (Math.abs(y-offset.current)>1) scroll.current?.scrollTo({y,animated:!reduced});
  },[reduced]);
  const restore = useCallback(() => {
    if (!scrollKey || !scrollReady || restored.current || !content.current || !viewport.current.height) return;
    const y=Math.min(readRootSnapshot(scrollKey+':scroll',0),Math.max(0,content.current-viewport.current.height));
    restored.current=true; offset.current=y; scroll.current?.scrollTo({y,animated:false});
  },[scrollKey,scrollReady]);
  const revealCaret = useCallback(() => {
    const data=latestGeometry.current;
    if (!data?.hasCaret || !data.hasViewport) return;
    const y=revealRange(data.caretTop,data.caretBottom,data.viewportTop,data.viewportHeight,data.viewportScrollY,content.current);
    if(Math.abs(y-data.viewportScrollY)>1) {offset.current=y;scroll.current?.scrollTo({y,animated:false});}
  },[]);
  useEffect(()=>{restored.current=false;measure(restore);},[scrollKey,measure,restore]);
  const contents=<><FormFocus.Provider value={reveal}><ScrollView ref={scroll} style={fill?{flex:1}:{flexShrink:1}} keyboardShouldPersistTaps="handled"
      contentContainerStyle={contentStyle} onLayout={() => { measure(restore); }}
      onContentSizeChange={(_,height)=>{content.current=height;measure(restore);}}
      onScroll={event => {offset.current=event.nativeEvent.contentOffset.y;if(scrollKey&&scrollReady&&restored.current)writeRootSnapshot(scrollKey+':scroll',offset.current);}} scrollEventThrottle={32}>
      {children}
    </ScrollView></FormFocus.Provider>
    {footer && <View onLayout={()=>{measure();}}>{footer}</View>}</>;
  const observe=(data:Geometry)=>{
      latestGeometry.current=data;
      if(data.shouldReveal) requestAnimationFrame(revealCaret);
  };
  // Sheets shrink to their content; pages fill their already-resized window.
  return <WindowGeometryRegion fill={fill} onGeometry={observe}>{contents}</WindowGeometryRegion>;
}
