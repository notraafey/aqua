import {
  Observation,
  GeoJsonPoint,
  ObservationIndicator,
} from '@aquasentinel/shared';
import { config } from '../../config/index.js';
import { logger } from '../../logging/index.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';
import { createProvenanceRecord } from '../../domain/provenance.js';
import { qualityAssessor } from '../../domain/quality/quality-assessor.js';

export interface CitizenSubmission {
  reporterName?: string;
  timestamp?: string;
  location: GeoJsonPoint;
  streamReachId?: string | null;
  indicator: ObservationIndicator | string;
  value?: number | string;
  description: string;
  photos?: string[];
  externalId?: string;
}

export interface ICitizenAdapter {
  submitReport(report: CitizenSubmission): Promise<Observation>;
  getRecentReports(options?: { streamReachId?: string }): Promise<Observation[]>;
  healthCheck(): Promise<{ healthy: boolean; details?: string; provider?: string }>;
}

/**
 * Deterministic Citizen Adapter
 * Normalizes community reports and produces realistic demo fixtures with media references
 */
export class DemoCitizenAdapter implements ICitizenAdapter {
  async submitReport(report: CitizenSubmission): Promise<Observation> {
    const obsId = generateId();
    const timestamp = report.timestamp || nowUtc();
    const hasPhotos = Array.isArray(report.photos) && report.photos.length > 0;
    const value = report.value !== undefined ? report.value : report.description;

    const assessment = qualityAssessor.assess({
      source: 'CITIZEN_REPORT',
      indicator: report.indicator,
      value,
      timestamp,
      hasPhotos,
      isAssociated: Boolean(report.streamReachId),
    });

    const sourceIdentifier = report.externalId || `CITIZEN-REP-${obsId.slice(0, 8)}`;

    const provenance = createProvenanceRecord({
      entityId: obsId,
      entityType: 'OBSERVATION',
      source: 'CITIZEN_REPORT',
      sourceIdentifier,
      acquisitionTimestamp: timestamp,
      processingMethod: 'CITIZEN_COMMUNITY_INTAKE_V1',
      qualityStatus: assessment.status,
      metadata: {
        reporterName: report.reporterName || 'Anonymous Citizen Scientist',
        description: report.description,
        photos: report.photos || [],
        mediaReferenceCount: report.photos ? report.photos.length : 0,
        qualityScore: assessment.score,
        qualityReasons: assessment.reasons,
        isDemoFixture: true,
      },
    });

    const obs: Observation = {
      id: obsId,
      source: 'CITIZEN_REPORT',
      timestamp,
      location: report.location,
      streamReachId: report.streamReachId || null,
      indicator: report.indicator,
      value,
      unit: 'categorical',
      quality: assessment.status,
      provenance,
      createdAt: nowUtc(),
      metadata: {
        description: report.description,
        photos: report.photos || [],
        reporterName: report.reporterName || 'Anonymous',
        isDemoFixture: true,
      },
    };

    logger.info('[DemoCitizenAdapter] Normalized citizen observation created', {
      id: obs.id,
      indicator: obs.indicator,
      photosCount: report.photos?.length ?? 0,
    });

    return obs;
  }

  async getRecentReports(options?: { streamReachId?: string }): Promise<Observation[]> {
    const isAlmyros = !options?.streamReachId || options.streamReachId.startsWith('7a3b4c12');
    const reachId = options?.streamReachId || (isAlmyros ? '7a3b4c12-89de-4f56-9abc-1234567890ab' : '8b4c5d23-90ef-5a67-abcd-2345678901bc');

    const fixtureReports: CitizenSubmission[] = [
      {
        externalId: 'OAH-CITIZEN-VOLOS-0142',
        reporterName: 'Eleni Papadopoulou',
        timestamp: '2026-09-16T14:30:00.000Z',
        location: {
          type: 'Point',
          coordinates: [22.7535, 39.1812],
        },
        streamReachId: reachId,
        indicator: 'WATER_COLOR',
        value: 'Murky Green with surface film',
        description: 'Water has turned a cloudy pea-soup green color near the footbridge. Noticeable film on surface.',
        photos: ['https://storage.aquasentinel.local/evidence/20260916_almyros_green.jpg'],
      },
      {
        externalId: 'OAH-CITIZEN-VOLOS-0145',
        reporterName: 'Dimitris Kostas',
        timestamp: '2026-09-16T17:15:00.000Z',
        location: {
          type: 'Point',
          coordinates: [22.7570, 39.1798],
        },
        streamReachId: reachId,
        indicator: 'ODOR',
        value: 'Strong Musty / Septic Odor',
        description: 'Distinct rotting vegetation / sulfur smell detected while walking along stream bank.',
        photos: [],
      },
    ];

    const observations: Observation[] = [];
    for (const report of fixtureReports) {
      observations.push(await this.submitReport(report));
    }
    return observations;
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string; provider?: string }> {
    return {
      healthy: true,
      provider: 'Demo Citizen Science Provider',
      details: 'Deterministic Citizen Science intake adapter operational (Demo Mode)',
    };
  }
}

/**
 * Live OAH Public Citizen Science Adapter
 */
export class OahCitizenAdapter implements ICitizenAdapter {
  private apiUrl?: string;

  constructor(apiUrl = config.CITIZEN_API_URL) {
    this.apiUrl = apiUrl;
  }

  async submitReport(report: CitizenSubmission): Promise<Observation> {
    const demoAdapter = new DemoCitizenAdapter();
    // Normalize using standard intake logic
    const obs = await demoAdapter.submitReport(report);
    // Mark as live
    if (obs.provenance.metadata) {
      obs.provenance.metadata.isDemoFixture = false;
    }
    if (obs.metadata) {
      obs.metadata.isDemoFixture = false;
    }

    // If external upstream API endpoint is configured, optionally post upstream
    if (this.apiUrl) {
      try {
        await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
        });
      } catch (err: any) {
        logger.warn('[OahCitizenAdapter] Could not forward to upstream citizen portal', {
          error: err.message,
        });
      }
    }

    return obs;
  }

  async getRecentReports(options?: { streamReachId?: string }): Promise<Observation[]> {
    if (this.apiUrl) {
      try {
        const res = await fetch(`${this.apiUrl}/reports`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const items = (await res.json()) as CitizenSubmission[];
          const results: Observation[] = [];
          for (const item of items) {
            results.push(await this.submitReport(item));
          }
          return results;
        }
      } catch (err: any) {
        logger.warn('[OahCitizenAdapter] Failed to fetch external reports, falling back to local intake', {
          error: err.message,
        });
      }
    }

    const demo = new DemoCitizenAdapter();
    return demo.getRecentReports(options);
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: string; provider?: string }> {
    return {
      healthy: true,
      provider: 'OAH Citizen Science Gateway',
      details: this.apiUrl
        ? `Configured to upstream: ${this.apiUrl}`
        : 'Running in direct intake mode (no external upstream required)',
    };
  }
}

let citizenAdapterInstance: ICitizenAdapter | null = null;

export function getCitizenAdapter(): ICitizenAdapter {
  if (!citizenAdapterInstance) {
    if (config.APP_MODE === 'live') {
      citizenAdapterInstance = new OahCitizenAdapter();
    } else {
      citizenAdapterInstance = new DemoCitizenAdapter();
    }
  }
  return citizenAdapterInstance;
}

export function resetCitizenAdapter(): void {
  citizenAdapterInstance = null;
}
