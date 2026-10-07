import { expect, it } from 'vitest';
import { lookupFoundation, sceneryFallback } from './foundation';
import { foundationCatalog } from './catalog.generated';
function luminance(hex: string) {
  const [r,g,b] = hex.slice(1).match(/../g)!.map(p => parseInt(p,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return r*.2126 + g*.7152 + b*.0722;
}
function contrast(a:string,b:string) { const x=luminance(a),y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
it('resolves static values at the supplied brightness without rewriting inputs', () => {
  const before = JSON.stringify(foundationCatalog);
  for (const b of ['light','dark'] as const) {
    const rose = lookupFoundation('rose',b);
    expect(rose.colors.dark).toBe(b === 'dark'); expect(rose.fallback).toBe('none');
    expect(lookupFoundation('not-a-palette',b).id).toBe('classic');
    expect(lookupFoundation('mist',b).fallback).toBe('unknown-id'); // Reserved, unbuilt sample ID.
    expect(sceneryFallback(rose)).toMatchObject({id:'classic',brightness:b,scene:null,fallback:'missing-art'});
    const invalid = {...foundationCatalog,palettes:foundationCatalog.palettes.map(p=>p.id==='rose'?{...p,colors:{light:{ink:'bad'},dark:{ink:'bad'}}}:p)};
    expect(lookupFoundation('rose',b,invalid)).toMatchObject({id:'classic',brightness:b,fallback:'invalid-tokens'});
    expect(lookupFoundation('rose',b,null)).toMatchObject({id:'classic',brightness:b,fallback:'emergency'});
    expect(lookupFoundation('classic',b).scene).toBeNull();
  }
  expect(JSON.stringify(foundationCatalog)).toBe(before);
});
it.each(foundationCatalog.palettes.map(p=>p.id))('%s opaque reading and state roles meet contrast thresholds', id => {
  for (const b of ['light','dark'] as const) {
    const c = lookupFoundation(id,b).colors;
    for (const surface of ['background','surface','soft'] as const) {
      for (const role of ['ink','muted','accent','danger','warning','success'] as const)
        expect(contrast(c[role],c[surface]),`${id}/${b}/${role} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      for (const role of ['outline','focus'] as const)
        expect(contrast(c[role],c[surface]),`${id}/${b}/${role} on ${surface}`).toBeGreaterThanOrEqual(3);
    }
    for (const [fg,bg] of [['accentInk','accent'],['onPrimaryPressed','primaryPressed'],['disabledInk','disabledSurface'],['selectedInk','selectedSurface'],['inverseInk','inverseSurface'],['dangerInk','dangerSurface']] as const)
      expect(contrast(c[fg],c[bg]),`${id}/${b}/${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
});
