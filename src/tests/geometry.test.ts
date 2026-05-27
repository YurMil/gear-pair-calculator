import { describe, it, expect } from 'vitest';
import { solveAlphaW, calculateSpurGeometry } from '../domain/spurGeometry';
import { calculateForces } from '../domain/forces';
import { calculateToothThickness } from '../domain/spurGeometry';
import { searchCandidates } from '../domain/ratioSearch';
import { DEFAULT_GEAR_INPUT, DEFAULT_LOAD_INPUT, DEFAULT_MATERIAL_INPUT } from '../domain/gearPair';

describe('Spur Gear Sizing Mathematics', () => {
  it('solves operating pressure angle correctly when shifts are zero', () => {
    const alphaW = solveAlphaW(20, 0, 0, 20, 40);
    // Convert to degrees
    const alphaWDeg = (alphaW * 180) / Math.PI;
    expect(alphaWDeg).toBeCloseTo(20.0, 4);
  });

  it('calculates standard pitch dimensions correctly', () => {
    const geometry = calculateSpurGeometry(DEFAULT_GEAR_INPUT, DEFAULT_MATERIAL_INPUT);

    // z1 = 20, z2 = 40, m = 2
    expect(geometry.pinion.d).toBe(40);
    expect(geometry.gear.d).toBe(80);
    expect(geometry.a).toBe(60);
    expect(geometry.aw).toBe(60);
    expect(geometry.ratio).toBe(2.0);
  });

  it('calculates profile-shifted geometry correctly', () => {
    const shiftedInput = {
      ...DEFAULT_GEAR_INPUT,
      x1: 0.2,
      x2: 0.3,
    };
    const geometry = calculateSpurGeometry(shiftedInput, DEFAULT_MATERIAL_INPUT);

    // operating pressure angle should be larger than 20
    expect(geometry.alphaW).toBeGreaterThan(20);
    // operating center distance should be larger than standard 60
    expect(geometry.aw).toBeGreaterThan(60);
  });

  it('calculates circular pitch tooth thickness correctly', () => {
    const thickness = calculateToothThickness(2, (20 * Math.PI) / 180, 0);
    expect(thickness).toBeCloseTo(Math.PI, 4); // s = m * pi / 2 = 2 * pi / 2 = pi
  });

  it('calculates mesh forces correctly', () => {
    const geometry = calculateSpurGeometry(DEFAULT_GEAR_INPUT, DEFAULT_MATERIAL_INPUT);
    const forces = calculateForces(geometry, DEFAULT_LOAD_INPUT);

    // T = 10 N*m, dw = 40 mm
    // Ft = 2 * T * 1000 / dw = 20000 / 40 = 500 N
    expect(forces.Ft).toBeCloseTo(500.0, 2);
    // Radial force Fr = Ft * tan(20 deg) = 500 * 0.36397 = 181.98 N
    // Radial force Fr = Ft * tan(20 deg) = 500 * 0.36397 = 181.985 N => 181.99
    expect(forces.Fr).toBeCloseTo(181.99, 2);
    // Linear speed v = pi * dw * n / 60000 = pi * 40 * 1500 / 60000 = pi * 60000 / 60000 = pi m/s = 3.14159 m/s
    expect(forces.v).toBeCloseTo(Math.PI, 4);
  });

  it('proposes valid candidates in ratio search', () => {
    const proposals = searchCandidates({
      ratioTarget: 2.0,
      centerDistanceTarget: 60,
      centerDistanceTol: 2.0,
    });

    expect(proposals.length).toBeGreaterThan(0);
    // Verify that the z1=20, z2=40, m=2 candidate exists in the top results
    const match = proposals.find(p => p.z1 === 20 && p.z2 === 40 && p.module === 2);
    expect(match).toBeDefined();
    expect(match!.centerDistance).toBe(60);
    expect(match!.ratio).toBe(2.0);
  });
});
