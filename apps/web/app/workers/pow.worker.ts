import { solvePow } from '../../shared/pow';
// Solves the OTP proof of work off the main thread, so the page stays responsive.
self.onmessage = (event: MessageEvent<{ challenge: string; bits: number }>) => {
  self.postMessage(solvePow(event.data.challenge, event.data.bits));
};
