export interface FhirValidationIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  path: string;
  details: string;
}

export interface FhirOperationOutcome {
  resourceType: 'OperationOutcome';
  issue: Array<{
    severity: 'fatal' | 'error' | 'warning' | 'information';
    code: string;
    diagnostics: string;
    location?: string[];
  }>;
}

export interface FhirValidationResult {
  valid: boolean;
  issues: FhirValidationIssue[];
  operationOutcome?: FhirOperationOutcome;
}

export class FhirValidationError extends Error {
  public readonly operationOutcome: FhirOperationOutcome;
  public readonly issues: FhirValidationIssue[];

  constructor(message: string, operationOutcome: FhirOperationOutcome, issues: FhirValidationIssue[]) {
    super(message);
    this.name = 'FhirValidationError';
    this.operationOutcome = operationOutcome;
    this.issues = issues;
    Object.setPrototypeOf(this, FhirValidationError.prototype);
  }
}

export class FhirValidator {
  /**
   * Validates an outbound FHIR R4 resource against standard FHIR R4 and
   * OneAquaHealth (OAH) profile constraints before delivery.
   * Defined in Phase 7 PRD Section 25.
   */
  static validate(resource: any): FhirValidationResult {
    const issues: FhirValidationIssue[] = [];

    if (!resource || typeof resource !== 'object') {
      return {
        valid: false,
        issues: [
          {
            severity: 'fatal',
            code: 'structure',
            path: '$',
            details: 'Resource must be a non-null JSON object',
          },
        ],
      };
    }

    // 1. Validate resourceType
    if (!resource.resourceType || typeof resource.resourceType !== 'string') {
      issues.push({
        severity: 'fatal',
        code: 'required',
        path: '$.resourceType',
        details: 'Missing or invalid resourceType property',
      });
      return this.formatResult(issues);
    }

    // 2. Validate id
    if (!resource.id || typeof resource.id !== 'string' || resource.id.trim().length === 0) {
      issues.push({
        severity: 'error',
        code: 'required',
        path: '$.id',
        details: 'Resource missing required logical identifier id',
      });
    }

    // Resource-specific validation
    switch (resource.resourceType) {
      case 'Observation':
        this.validateObservation(resource, issues);
        break;
      case 'Flag':
        this.validateFlag(resource, issues);
        break;
      case 'Task':
        this.validateTask(resource, issues);
        break;
      case 'Subscription':
        this.validateSubscription(resource, issues);
        break;
      default:
        // Other types pass generic check
        break;
    }

    return this.formatResult(issues);
  }

  private static validateObservation(obs: any, issues: FhirValidationIssue[]): void {
    const validStatuses = [
      'registered',
      'preliminary',
      'final',
      'amended',
      'corrected',
      'cancelled',
      'entered-in-error',
      'unknown',
    ];
    if (!obs.status || !validStatuses.includes(obs.status)) {
      issues.push({
        severity: 'error',
        code: 'value',
        path: '$.status',
        details: `Observation status must be one of: ${validStatuses.join(', ')}. Found: '${obs.status}'`,
      });
    }

    if (!obs.code || !obs.code.coding || !Array.isArray(obs.code.coding) || obs.code.coding.length === 0) {
      issues.push({
        severity: 'error',
        code: 'required',
        path: '$.code.coding',
        details: 'Observation must contain at least one valid coding in code.coding',
      });
    } else {
      for (let i = 0; i < obs.code.coding.length; i++) {
        const c = obs.code.coding[i];
        if (!c.system || !c.code) {
          issues.push({
            severity: 'error',
            code: 'required',
            path: `$.code.coding[${i}]`,
            details: 'Coding entry must contain both system and code',
          });
        }
      }
    }

    if (!obs.subject || !obs.subject.reference || typeof obs.subject.reference !== 'string') {
      issues.push({
        severity: 'error',
        code: 'required',
        path: '$.subject.reference',
        details: 'Observation must reference a valid subject (e.g. Location/{reachId})',
      });
    }

    if (obs.effectiveDateTime && isNaN(Date.parse(obs.effectiveDateTime))) {
      issues.push({
        severity: 'error',
        code: 'value',
        path: '$.effectiveDateTime',
        details: 'effectiveDateTime must be a valid ISO-8601 timestamp string',
      });
    }

    if (obs.valueQuantity) {
      if (typeof obs.valueQuantity.value !== 'number' || isNaN(obs.valueQuantity.value)) {
        issues.push({
          severity: 'error',
          code: 'value',
          path: '$.valueQuantity.value',
          details: 'valueQuantity.value must be a valid finite number',
        });
      }
    } else if (!obs.valueString && !obs.valueCodeableConcept) {
      issues.push({
        severity: 'error',
        code: 'required',
        path: '$.value[x]',
        details: 'Observation must have a value (valueQuantity, valueString, or valueCodeableConcept)',
      });
    }
  }

  private static validateFlag(flag: any, issues: FhirValidationIssue[]): void {
    const validStatuses = ['active', 'inactive', 'entered-in-error'];
    if (!flag.status || !validStatuses.includes(flag.status)) {
      issues.push({
        severity: 'error',
        code: 'value',
        path: '$.status',
        details: `Flag status must be one of: ${validStatuses.join(', ')}. Found: '${flag.status}'`,
      });
    }

    if (!flag.code || !flag.code.coding || !Array.isArray(flag.code.coding) || flag.code.coding.length === 0) {
      issues.push({
        severity: 'error',
        code: 'required',
        path: '$.code.coding',
        details: 'Flag must have at least one coding identifying the hazard or early-warning',
      });
    }

    if (!flag.subject || !flag.subject.reference) {
      issues.push({
        severity: 'error',
        code: 'required',
        path: '$.subject.reference',
        details: 'Flag must reference a subject (e.g. Location/{reachId})',
      });
    }

    if (flag.period?.start && isNaN(Date.parse(flag.period.start))) {
      issues.push({
        severity: 'error',
        code: 'value',
        path: '$.period.start',
        details: 'period.start must be a valid ISO-8601 timestamp',
      });
    }
  }

  private static validateTask(task: any, issues: FhirValidationIssue[]): void {
    const validStatuses = [
      'draft',
      'requested',
      'received',
      'accepted',
      'rejected',
      'ready',
      'cancelled',
      'in-progress',
      'on-hold',
      'failed',
      'completed',
      'entered-in-error',
    ];
    if (!task.status || !validStatuses.includes(task.status)) {
      issues.push({
        severity: 'error',
        code: 'value',
        path: '$.status',
        details: `Task status must be one of: ${validStatuses.join(', ')}. Found: '${task.status}'`,
      });
    }

    if (!task.intent || typeof task.intent !== 'string') {
      issues.push({
        severity: 'error',
        code: 'required',
        path: '$.intent',
        details: 'Task missing required intent (e.g. order, proposal)',
      });
    }

    if (!task.code || !task.code.coding || !Array.isArray(task.code.coding) || task.code.coding.length === 0) {
      issues.push({
        severity: 'error',
        code: 'required',
        path: '$.code.coding',
        details: 'Task must contain coding for action type or measure',
      });
    }

    if (task.authoredOn && isNaN(Date.parse(task.authoredOn))) {
      issues.push({
        severity: 'error',
        code: 'value',
        path: '$.authoredOn',
        details: 'authoredOn must be a valid ISO-8601 timestamp',
      });
    }
  }

  private static validateSubscription(sub: any, issues: FhirValidationIssue[]): void {
    const validStatuses = ['requested', 'active', 'error', 'off'];
    if (!sub.status || !validStatuses.includes(sub.status)) {
      issues.push({
        severity: 'error',
        code: 'value',
        path: '$.status',
        details: `Subscription status must be one of: ${validStatuses.join(', ')}. Found: '${sub.status}'`,
      });
    }

    if (!sub.criteria || typeof sub.criteria !== 'string') {
      issues.push({
        severity: 'error',
        code: 'required',
        path: '$.criteria',
        details: 'Subscription must specify criteria string (e.g. Flag?status=active)',
      });
    }

    if (!sub.channel || !sub.channel.type || !sub.channel.endpoint) {
      issues.push({
        severity: 'error',
        code: 'required',
        path: '$.channel',
        details: 'Subscription channel must specify type and endpoint URL',
      });
    }
  }

  private static formatResult(issues: FhirValidationIssue[]): FhirValidationResult {
    const hasErrors = issues.some((i) => i.severity === 'error' || i.severity === 'fatal');
    if (!hasErrors) {
      return { valid: true, issues };
    }

    const operationOutcome: FhirOperationOutcome = {
      resourceType: 'OperationOutcome',
      issue: issues.map((i) => ({
        severity: i.severity,
        code: i.code,
        diagnostics: i.details,
        location: [i.path],
      })),
    };

    return {
      valid: false,
      issues,
      operationOutcome,
    };
  }

  static validateOrThrow(resource: any): void {
    const result = this.validate(resource);
    if (!result.valid && result.operationOutcome) {
      const summary = result.issues.map((i) => `[${i.severity}] ${i.path}: ${i.details}`).join('; ');
      throw new FhirValidationError(`FHIR validation failed: ${summary}`, result.operationOutcome, result.issues);
    }
  }
}
