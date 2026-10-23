import { solvePow } from '#shared/pow';
type Purpose = 'LOGIN' | 'RESET' | 'CLAIM';
function inWorker(challenge: string, bits: number) {
  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/pow.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<string>) => {
      resolve(event.data);
      worker.terminate();
    };
    worker.onerror = (error) => {
      reject(error);
      worker.terminate();
    };
    worker.postMessage({ challenge, bits });
  });
}
/** Fetches and solves the proof of work that a public OTP request needs (G5). */
export function useProofOfWork() {
  const api = useApi();
  return async (purpose: Purpose, mobile: string) => {
    const c = await api.post('/api/v2/auth/challenge', { purpose, mobile });
    const counter = await inWorker(c.challenge, c.bits).catch(() => solvePow(c.challenge, c.bits));
    return { challenge: c.challenge, counter };
  };
}
