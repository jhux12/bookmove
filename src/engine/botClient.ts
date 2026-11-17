import { BotProfile } from '../types/chess';

export function requestBotMove(
  fen: string,
  bot: BotProfile
): Promise<{ from: string; to: string; promotion?: string } | null> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      clearTimeout(timeout);
      worker.terminate();
    };
    const timeout = window.setTimeout(() => {
      finish();
      reject(new Error('Move calculation timed out.'));
    }, 15000);
    worker.onmessage = ({ data }) => {
      finish();
      data.error ? reject(new Error(data.error)) : resolve(data.move);
    };
    worker.onerror = () => {
      finish();
      reject(new Error('Move calculation failed.'));
    };
    worker.postMessage({ fen, bot });
  });
}
