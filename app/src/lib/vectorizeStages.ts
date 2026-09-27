import type { VectorizeStage } from '../types';

export function vectorizeStageLabel(stage: VectorizeStage): string {
  switch (stage) {
    case 'preparing':
      return 'Preparing image…';
    case 'tracing':
      return 'Tracing shapes…';
    case 'finishing':
      return 'Adding finishing touches…';
    default:
      return 'Tracing…';
  }
}
