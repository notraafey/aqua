import { config } from '../../config/index.js';
import {
  IStreamReachRepository,
  IObservationRepository,
  IIncidentRepository,
  ITaskRepository,
  IRecommendationRepository,
  ICatalogueRepository,
  IAuditLogRepository,
  IEvidenceAssessmentRepository,
  IForecastRepository,
  IScenarioRepository,
  IEarlyWarningRepository,
  IModelEvaluationRepository,
  IOutboxRepository,
  IAcknowledgementRepository,
  IInteroperabilityAuditRepository,
  IFhirSubscriptionRepository,
  IVerificationRepository,
  IFieldActorRepository,
  IIncidentOutcomeRepository,
} from './types.js';
import {
  PostgresStreamReachRepository,
  PostgresObservationRepository,
  PostgresIncidentRepository,
  PostgresTaskRepository,
  PostgresRecommendationRepository,
  PostgresCatalogueRepository,
  PostgresAuditLogRepository,
  PostgresEvidenceAssessmentRepository,
  PostgresForecastRepository,
  PostgresScenarioRepository,
  PostgresEarlyWarningRepository,
  PostgresModelEvaluationRepository,
  PostgresOutboxRepository,
  PostgresAcknowledgementRepository,
  PostgresInteroperabilityAuditRepository,
  PostgresFhirSubscriptionRepository,
  PostgresVerificationRepository,
  PostgresFieldActorRepository,
  PostgresIncidentOutcomeRepository,
} from './postgres-repositories.js';
import {
  InMemoryStreamReachRepository,
  InMemoryObservationRepository,
  InMemoryIncidentRepository,
  InMemoryTaskRepository,
  InMemoryRecommendationRepository,
  InMemoryCatalogueRepository,
  InMemoryAuditLogRepository,
  InMemoryEvidenceAssessmentRepository,
  InMemoryForecastRepository,
  InMemoryScenarioRepository,
  InMemoryEarlyWarningRepository,
  InMemoryModelEvaluationRepository,
  InMemoryOutboxRepository,
  InMemoryAcknowledgementRepository,
  InMemoryInteroperabilityAuditRepository,
  InMemoryFhirSubscriptionRepository,
  InMemoryVerificationRepository,
  InMemoryFieldActorRepository,
  InMemoryIncidentOutcomeRepository,
} from './in-memory-repositories.js';
import { logger } from '../../logging/logger.js';

export * from './types.js';
export * from './postgres-repositories.js';
export * from './in-memory-repositories.js';

export interface RepositoryContainer {
  streamReaches: IStreamReachRepository;
  observations: IObservationRepository;
  incidents: IIncidentRepository;
  tasks: ITaskRepository;
  recommendations: IRecommendationRepository;
  catalogue: ICatalogueRepository;
  auditLogs: IAuditLogRepository;
  evidenceAssessments: IEvidenceAssessmentRepository;
  forecasts: IForecastRepository;
  scenarios: IScenarioRepository;
  earlyWarnings: IEarlyWarningRepository;
  modelEvaluations: IModelEvaluationRepository;
  outbox: IOutboxRepository;
  acknowledgements: IAcknowledgementRepository;
  interoperabilityAudit: IInteroperabilityAuditRepository;
  fhirSubscriptions: IFhirSubscriptionRepository;
  verifications: IVerificationRepository;
  fieldActors: IFieldActorRepository;
  incidentOutcomes: IIncidentOutcomeRepository;
  isPostgres: boolean;
}

let activeContainer: RepositoryContainer | null = null;

export function createRepositories(forceInMemory = false): RepositoryContainer {
  if (forceInMemory || config.NODE_ENV === 'test') {
    logger.info('Using InMemory repository storage');
    return {
      streamReaches: new InMemoryStreamReachRepository(),
      observations: new InMemoryObservationRepository(),
      incidents: new InMemoryIncidentRepository(),
      tasks: new InMemoryTaskRepository(),
      recommendations: new InMemoryRecommendationRepository(),
      catalogue: new InMemoryCatalogueRepository(),
      auditLogs: new InMemoryAuditLogRepository(),
      evidenceAssessments: new InMemoryEvidenceAssessmentRepository(),
      forecasts: new InMemoryForecastRepository(),
      scenarios: new InMemoryScenarioRepository(),
      earlyWarnings: new InMemoryEarlyWarningRepository(),
      modelEvaluations: new InMemoryModelEvaluationRepository(),
      outbox: new InMemoryOutboxRepository(),
      acknowledgements: new InMemoryAcknowledgementRepository(),
      interoperabilityAudit: new InMemoryInteroperabilityAuditRepository(),
      fhirSubscriptions: new InMemoryFhirSubscriptionRepository(),
      verifications: new InMemoryVerificationRepository(),
      fieldActors: new InMemoryFieldActorRepository(),
      incidentOutcomes: new InMemoryIncidentOutcomeRepository(),
      isPostgres: false,
    };
  }

  logger.info('Using PostgreSQL repository storage');
  return {
    streamReaches: new PostgresStreamReachRepository(),
    observations: new PostgresObservationRepository(),
    incidents: new PostgresIncidentRepository(),
    tasks: new PostgresTaskRepository(),
    recommendations: new PostgresRecommendationRepository(),
    catalogue: new PostgresCatalogueRepository(),
    auditLogs: new PostgresAuditLogRepository(),
    evidenceAssessments: new PostgresEvidenceAssessmentRepository(),
    forecasts: new PostgresForecastRepository(),
    scenarios: new PostgresScenarioRepository(),
    earlyWarnings: new PostgresEarlyWarningRepository(),
    modelEvaluations: new PostgresModelEvaluationRepository(),
    outbox: new PostgresOutboxRepository(),
    acknowledgements: new PostgresAcknowledgementRepository(),
    interoperabilityAudit: new PostgresInteroperabilityAuditRepository(),
    fhirSubscriptions: new PostgresFhirSubscriptionRepository(),
    verifications: new PostgresVerificationRepository(),
    fieldActors: new PostgresFieldActorRepository(),
    incidentOutcomes: new PostgresIncidentOutcomeRepository(),
    isPostgres: true,
  };
}

export function getRepositories(): RepositoryContainer {
  if (!activeContainer) {
    activeContainer = createRepositories();
  }
  return activeContainer;
}

export function setRepositories(container: RepositoryContainer): void {
  activeContainer = container;
}

export function resetRepositories(): void {
  activeContainer = null;
}
