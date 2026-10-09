import { expect, it } from 'vitest';
import { revealRange } from './form-geometry';
it('reveals a lower caret without subtracting the sibling footer twice',()=>{
  expect(revealRange(410,430,100,300,100,1000)).toBe(142);
  expect(revealRange(180,200,100,300,100,1000)).toBe(100);
});
it('handles upward selections and clamps to reachable content',()=>{
  expect(revealRange(80,96,100,300,100,1000)).toBe(68);
  expect(revealRange(800,830,100,300,100,500)).toBe(200);
});
