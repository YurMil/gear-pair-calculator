import type { GearInput, Point2D } from '../domain/types';

export type CadWorkerGenerateRequest = {
  type: 'generate-step';
  requestId: string;
  gearInput: GearInput;
  pinionPoints: Point2D[];
  gearPoints: Point2D[];
  aw: number;
};

export type CadWorkerWarmupRequest = {
  type: 'warmup';
  requestId: string;
};

export type CadWorkerRequest = CadWorkerGenerateRequest | CadWorkerWarmupRequest;

export type CadWorkerProgressMessage = {
  type: 'progress';
  requestId: string;
  stage: 'init' | 'pinion' | 'gear' | 'assembly' | 'export';
  done: number;
  total: number;
};

export type CadWorkerResultMessage =
  | {
      type: 'result';
      requestId: string;
      ok: true;
      payload: {
        pinionStep: ArrayBuffer;
        gearStep: ArrayBuffer;
        assemblyStep: ArrayBuffer;
      };
    }
  | {
      type: 'result';
      requestId: string;
      ok: false;
      payload: {message: string; stack?: string};
    };

export type CadWorkerMessage = CadWorkerProgressMessage | CadWorkerResultMessage;
