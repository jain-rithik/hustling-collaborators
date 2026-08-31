import { describe, expect, it } from 'vitest';
import { floorToStep, round2 } from '../../src/domain/util.js';

describe('rounding helpers', () => {
  it('round2 kills binary-float drift', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1516.6666)).toBe(1516.67);
  });

  it('floorToStep never rounds a leave credit up', () => {
    expect(floorToStep(0.9167)).toBe(0.5);
    expect(floorToStep(5.5)).toBe(5.5);
    expect(floorToStep(6.4167)).toBe(6);
    expect(floorToStep(2.6, 0.25)).toBe(2.5);
  });

  it('degrades to plain 2-dp rounding when the step is not positive', () => {
    expect(floorToStep(2.345, 0)).toBe(2.35);
    expect(floorToStep(2.345, -1)).toBe(2.35);
  });
});
