import { config } from '../../config/index.js';
import { IFhirAdapter } from './types.js';
import { HapiFhirAdapter } from './hapi-adapter.js';
import { DemoFhirAdapter } from './demo-adapter.js';

export * from './types.js';
export * from './mapper.js';
export * from './validator.js';
export * from './hapi-adapter.js';
export * from './demo-adapter.js';

let activeFhirAdapter: IFhirAdapter | null = null;

export function getFhirAdapter(): IFhirAdapter {
  if (!activeFhirAdapter) {
    if (config.APP_MODE === 'demo' || config.NODE_ENV === 'test') {
      activeFhirAdapter = new DemoFhirAdapter();
    } else {
      activeFhirAdapter = new HapiFhirAdapter(config.FHIR_SERVER_URL);
    }
  }
  return activeFhirAdapter;
}

export function setFhirAdapter(adapter: IFhirAdapter): void {
  activeFhirAdapter = adapter;
}
