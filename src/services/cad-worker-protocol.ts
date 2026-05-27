import type { GearInput } from '../domain/types';

export type CadWorkerBuildKind = 'pinion' | 'gear' | 'assembly';

export type CadWorkerBuildRequest = {
  type: 'build';
  requestId: string;
  kind: CadWorkerBuildKind;
  gearInput: GearInput;
  deltaY: number;
  aw: number;
};

export type CadWorkerWarmupRequest = {
  type: 'warmup';
  requestId: string;
};

export type CadWorkerRequest = CadWorkerBuildRequest | CadWorkerWarmupRequest;

export type CadWorkerProgressStage = 'init' | 'profile' | 'solid' | 'compound' | 'export';

export type CadWorkerProgressMessage = {
  type: 'progress';
  requestId: string;
  stage: CadWorkerProgressStage;
  done: number;
  total: number;
};

export type CadWorkerResultMessage =
  | {
      type: 'result';
      requestId: string;
      ok: true;
      payload: { step: ArrayBuffer };
    }
  | {
      type: 'result';
      requestId: string;
      ok: false;
      payload: { message: string; stack?: string };
    };

export type CadWorkerMessage = CadWorkerProgressMessage | CadWorkerResultMessage;
