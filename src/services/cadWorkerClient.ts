import type { GearInput } from '../domain/types';
import type {
  CadWorkerBuildKind,
  CadWorkerBuildRequest,
  CadWorkerMessage,
  CadWorkerProgressMessage,
  CadWorkerWarmupRequest,
} from './cad-worker-protocol';

const POOL_SIZE = 2;

const createRequestId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

type ResolveFn = (payload: { step: ArrayBuffer }) => void;
type RejectFn = (error: Error) => void;

type PendingRequest = {
  workerIdx: number;
  resolve: ResolveFn;
  reject: RejectFn;
  onProgress?: (message: CadWorkerProgressMessage) => void;
};

const workers: (Worker | null)[] = Array.from({ length: POOL_SIZE }, () => null);
const workerLoad: number[] = Array.from({ length: POOL_SIZE }, () => 0);
const pending = new Map<string, PendingRequest>();

const handleWorkerError = (idx: number, error: Error) => {
  pending.forEach((handler, id) => {
    if (handler.workerIdx === idx) {
      pending.delete(id);
      handler.reject(error);
    }
  });
  workerLoad[idx] = 0;
};

const ensureWorker = (idx: number): Worker => {
  let w = workers[idx];
  if (w) return w;

  w = new Worker(new URL('./cad-worker.ts', import.meta.url), { type: 'module' });
  workers[idx] = w;

  w.addEventListener('message', (event: MessageEvent<CadWorkerMessage>) => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;

    if (message.type === 'progress') {
      const handler = pending.get(message.requestId);
      handler?.onProgress?.(message);
      return;
    }

    if (message.type === 'result') {
      const handler = pending.get(message.requestId);
      if (!handler) return;
      pending.delete(message.requestId);
      workerLoad[handler.workerIdx] = Math.max(0, workerLoad[handler.workerIdx] - 1);

      if (message.ok) {
        handler.resolve(message.payload);
      } else {
        const payload = message.payload as { message: string; stack?: string };
        const err = new Error(payload.message);
        if (payload.stack) err.stack = payload.stack;
        handler.reject(err);
      }
    }
  });

  w.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : new Error(String(event.message));
    handleWorkerError(idx, error);
  });

  return w;
};

// Pick the least-loaded worker, instantiating a fresh slot if any is still idle.
const pickWorker = (): number => {
  for (let i = 0; i < POOL_SIZE; i++) {
    if (workers[i] === null && workerLoad[i] === 0) {
      ensureWorker(i);
      return i;
    }
  }
  let bestIdx = 0;
  for (let i = 1; i < POOL_SIZE; i++) {
    if (workerLoad[i] < workerLoad[bestIdx]) bestIdx = i;
  }
  ensureWorker(bestIdx);
  return bestIdx;
};

export const warmupCadWorker = async () => {
  // Warm up both workers in parallel so the first per-kind build doesn't pay OpenCascade boot cost.
  const warmOne = (idx: number) =>
    new Promise<void>((resolve, reject) => {
      const w = ensureWorker(idx);
      const requestId = createRequestId();
      workerLoad[idx]++;
      pending.set(requestId, {
        workerIdx: idx,
        resolve: () => resolve(),
        reject,
      });
      const request: CadWorkerWarmupRequest = { type: 'warmup', requestId };
      w.postMessage(request);
    });

  await Promise.all(Array.from({ length: POOL_SIZE }, (_, i) => warmOne(i)));
};

export const buildStepInWorker = async (
  kind: CadWorkerBuildKind,
  gearInput: GearInput,
  deltaY: number,
  aw: number,
  options?: { onProgress?: (message: CadWorkerProgressMessage) => void }
): Promise<ArrayBuffer> => {
  const idx = pickWorker();
  const w = ensureWorker(idx);
  const requestId = createRequestId();
  workerLoad[idx]++;

  return new Promise<ArrayBuffer>((resolve, reject) => {
    pending.set(requestId, {
      workerIdx: idx,
      resolve: (payload) => resolve(payload.step),
      reject,
      onProgress: options?.onProgress,
    });
    const request: CadWorkerBuildRequest = {
      type: 'build',
      requestId,
      kind,
      gearInput,
      deltaY,
      aw,
    };
    w.postMessage(request);
  });
};
