// Original packaged tone; no external audio provider is needed before unlock.
import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './tools.mjs';

const rate = 22_050;
const duration = 2;
const count = rate * duration;
const wave = Buffer.alloc(44 + count * 2);
wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(rate, 24); wave.writeUInt32LE(rate * 2, 28);
wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34);
wave.write('data', 36); wave.writeUInt32LE(count * 2, 40);
const notes = [650, 820, 650, 1000];
for (let index = 0; index < count; index++) {
  const time = index / rate;
  const slot = Math.floor(time / 0.32);
  const offset = time - slot * 0.32;
  const envelope = Math.min(offset / 0.025, (0.22 - offset) / 0.025, 1);
  const sample = slot < notes.length && offset < 0.22
    ? Math.sin(2 * Math.PI * notes[slot] * offset) * Math.max(envelope, 0) * 0.32 : 0;
  wave.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
}
const directory = join(root, 'modules/remilo-alarm/android/src/main/res/raw');
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, 'remilo_alarm.wav'), wave);
