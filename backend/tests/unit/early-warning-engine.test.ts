import { describe, it, expect } from 'vitest';
import { EarlyWarningEngine } from '../../src/domain/analytics/early-warning-engine.js';
import { Observation, StreamReach } from '@aquasentinel/shared';

describe('EarlyWarningEngine Unit Tests', () => {
  const sampleReach: StreamReach = {
    id: 'reach-almyros-ew',
    name: 'Almyros Stream',
    city: 'Volos',
    region: 'Thessaly',
    monitoringStatus: 'ACTIVE',
    geometry: { type: 'Point', coordinates: [22.75, 39.18] },
    baselineData: { typicalNdci: 0.12, typicalTurbidity: 4.0 },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  const baseSatelliteObs: Observation[] = [
    {
      id: 'obs-sat-1',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.13,
      timestamp: '2026-09-01T10:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: sampleReach.id,
      qualityScore: 0.9,
      qualityStatus: 'ASSESSED',
      provenanceRecord: {
        ingestedAt: '2026-09-01T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'h1',
        isSynthetic: false,
      },
      createdAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'obs-sat-2',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.22, // elevated
      timestamp: '2026-09-03T10:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: sampleReach.id,
      qualityScore: 0.9,
      qualityStatus: 'ASSESSED',
      provenanceRecord: {
        ingestedAt: '2026-09-03T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'h2',
        isSynthetic: false,
      },
      createdAt: '2026-09-03T10:00:00.000Z',
    },
    {
      id: 'obs-sat-3',
      source: 'SATELLITE_SENTINEL2',
      indicator: 'NDCI',
      value: 0.38, // highly elevated (>3x baseline)
      timestamp: '2026-09-05T10:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: sampleReach.id,
      qualityScore: 0.95,
      qualityStatus: 'ASSESSED',
      provenanceRecord: {
        ingestedAt: '2026-09-05T10:00:00.000Z',
        sourceSystem: 'Copernicus',
        processingPipelineVersion: '1.0',
        contentHash: 'h3',
        isSynthetic: false,
      },
      createdAt: '2026-09-05T10:00:00.000Z',
    },
  ];

  it('triggers ADVISORY for sustained baseline elevation and increasing trend without multi-source confirmation', () => {
    const warning = EarlyWarningEngine.evaluate({
      reach: sampleReach,
      observations: baseSatelliteObs,
    });

    expect(warning).not.toBeNull();
    expect(warning?.warningLevel).toBe('ADVISORY');
    expect(warning?.confidence).toBe('MEDIUM');
    expect(warning?.triggerReason).toContain('Almyros Stream');
    expect(warning?.contributingFactors.length).toBeGreaterThanOrEqual(2);
  });

  it('escalates to WARNING with HIGH confidence when citizen observation corroborates', () => {
    const citizenObs: Observation = {
      id: 'obs-cit-1',
      source: 'CITIZEN_REPORT',
      indicator: 'FOAM',
      value: 'Visible green surface streaks and odor',
      timestamp: '2026-09-05T11:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: sampleReach.id,
      qualityScore: 0.8,
      qualityStatus: 'ASSESSED',
      provenanceRecord: {
        ingestedAt: '2026-09-05T11:00:00.000Z',
        sourceSystem: 'CitizenApp',
        processingPipelineVersion: '1.0',
        contentHash: 'hcit',
        isSynthetic: false,
      },
      createdAt: '2026-09-05T11:00:00.000Z',
    };

    const warning = EarlyWarningEngine.evaluate({
      reach: sampleReach,
      observations: [...baseSatelliteObs, citizenObs],
    });

    expect(warning).not.toBeNull();
    expect(warning?.warningLevel).toBe('WARNING');
    expect(warning?.confidence).toBe('HIGH');
    expect(warning?.contributingFactors.some((f) => f.includes('citizen reporting'))).toBe(true);
    expect(warning?.recommendedAction).toContain('Priority recommendation');
  });

  it('downgrades confidence to LOW when contradictory normal observation exists within 24 hours', () => {
    const contradictoryObs: Observation = {
      id: 'obs-contradict-1',
      source: 'IN_SITU_SENSOR',
      indicator: 'NDCI',
      value: 0.11, // clean normal reading near baseline
      timestamp: '2026-09-05T12:00:00.000Z',
      location: { type: 'Point', coordinates: [22.75, 39.18] },
      streamReachId: sampleReach.id,
      qualityScore: 0.95,
      qualityStatus: 'ASSESSED',
      provenanceRecord: {
        ingestedAt: '2026-09-05T12:00:00.000Z',
        sourceSystem: 'YSI-Sensor',
        processingPipelineVersion: '1.0',
        contentHash: 'hysi',
        isSynthetic: false,
      },
      createdAt: '2026-09-05T12:00:00.000Z',
    };

    const warning = EarlyWarningEngine.evaluate({
      reach: sampleReach,
      observations: [...baseSatelliteObs, contradictoryObs],
    });

    expect(warning).not.toBeNull();
    expect(warning?.confidence).toBe('LOW');
    expect(warning?.contributingFactors.some((f) => f.includes('conflicting'))).toBe(true);
  });

  it('returns null when conditions are normal and stable', () => {
    const normalObs: Observation[] = [
      {
        ...baseSatelliteObs[0],
        id: 'obs-norm-1',
        value: 0.12,
        timestamp: '2026-09-01T10:00:00.000Z',
      },
      {
        ...baseSatelliteObs[0],
        id: 'obs-norm-2',
        value: 0.11,
        timestamp: '2026-09-03T10:00:00.000Z',
      },
      {
        ...baseSatelliteObs[0],
        id: 'obs-norm-3',
        value: 0.12,
        timestamp: '2026-09-05T10:00:00.000Z',
      },
    ];

    const warning = EarlyWarningEngine.evaluate({
      reach: sampleReach,
      observations: normalObs,
    });

    expect(warning).toBeNull();
  });
});
