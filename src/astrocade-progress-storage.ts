import { createInitialProgress, decodeProgress, encodeProgress, isStageUnlocked, type CampaignProgress, type ProgressTransition } from './progress.js';
import { type ProgressStorageProtection, type ProgressStorageResult, type ProgressStorageSnapshot } from './progress-storage.js';

export type AstrocadeProgressPort = Readonly<{
  getUserGameState(): Promise<{ state: unknown; success?: boolean }>;
  saveUserGameState(state: object): Promise<{ success?: boolean }>;
}>;

export type AstrocadeProgressStorage = Readonly<{
  snapshot(): ProgressStorageSnapshot;
  saveAdvanced(transition: Extract<ProgressTransition, { kind: 'advanced' }>): Promise<ProgressStorageSnapshot>;
  reset(decision: 'confirmed' | 'cancelled'): Promise<ProgressStorageSnapshot>;
}>;

export async function openAstrocadeProgressStorage(port: AstrocadeProgressPort): Promise<AstrocadeProgressStorage> {
  let progress = createInitialProgress();
  let protection: ProgressStorageProtection = { kind: 'ready' };
  let result: ProgressStorageResult = { kind: 'loaded', source: 'missing' };
  let pending: Promise<void> = Promise.resolve();
  const snapshot = (): ProgressStorageSnapshot => Object.freeze({ progress, protection, result });
  const finish = (next: ProgressStorageResult) => { result = Object.freeze(next); return snapshot(); };
  async function read(phase: 'load' | 'save_read') {
    try {
      const response = await port.getUserGameState();
      if (response.success === false) throw new Error('Astrocade progress read failed');
      const raw = response.state === null ? null : JSON.stringify(response.state);
      if (raw === undefined) throw new Error('Astrocade progress response is invalid');
      const decoded = decodeProgress(raw);
      if (decoded.kind === 'rejected') {
        protection = { kind: 'protected', reason: decoded.reason };
        finish({ kind: 'recovery_required', phase, reason: decoded.reason });
      }
      return decoded;
    } catch (error) {
      protection = { kind: 'protected', reason: 'read_error', error };
      finish({ kind: 'not_saved', phase, error });
      return null;
    }
  }
  async function write(target: CampaignProgress, operation: 'save' | 'reset') {
    const expected = encodeProgress(target);
    try {
      const response = await port.saveUserGameState(JSON.parse(expected) as object);
      if (response.success === false) throw new Error('Astrocade progress write failed');
    } catch (error) {
      finish({ kind: 'not_saved', phase: operation === 'save' ? 'save_write' : 'reset_write', error });
      return false;
    }
    const phase = operation === 'save' ? 'save_verify' : 'reset_verify';
    try {
      const response = await port.getUserGameState();
      if (response.success === false) throw new Error('Astrocade progress verification failed');
      const actual = response.state === null ? null : JSON.stringify(response.state);
      const decoded = decodeProgress(actual ?? null);
      if (decoded.kind !== 'valid' || encodeProgress(decoded.progress) !== expected) {
        finish({ kind: 'uncertain', phase, reason: 'mismatch' });
        return false;
      }
    } catch (error) {
      finish({ kind: 'uncertain', phase, reason: 'read_error', error });
      return false;
    }
    return true;
  }
  function enqueue(operation: () => Promise<ProgressStorageSnapshot>): Promise<ProgressStorageSnapshot> {
    const next = pending.then(operation);
    pending = next.then(() => undefined, () => undefined);
    return next;
  }
  const loaded = await read('load');
  if (loaded?.kind === 'valid') {
    progress = loaded.progress;
    finish({ kind: 'loaded', source: 'valid' });
  }
  return Object.freeze({
    snapshot,
    saveAdvanced(transition: Extract<ProgressTransition, { kind: 'advanced' }>) {
      return enqueue(async () => {
        if (transition.kind !== 'advanced') throw new TypeError('Expected an advanced progress transition');
        const candidate = transition.progress;
        if (isStageUnlocked({ progress, stageId: candidate.highestUnlockedStageId })) return finish({ kind: 'unchanged' });
        progress = Object.freeze({ version: 1, highestUnlockedStageId: candidate.highestUnlockedStageId });
        if (protection.kind === 'protected') return finish({ kind: 'protected' });
        const previous = await read('save_read');
        if (previous === null || previous.kind === 'rejected') return snapshot();
        if (previous.kind === 'valid' && isStageUnlocked({ progress: previous.progress, stageId: progress.highestUnlockedStageId })) progress = previous.progress;
        if (await write(progress, 'save')) finish({ kind: 'saved' });
        return snapshot();
      });
    },
    reset(decision: 'confirmed' | 'cancelled') {
      return enqueue(async () => {
        if (decision === 'cancelled') return finish({ kind: 'cancelled' });
        if (decision !== 'confirmed') throw new TypeError('Expected an explicit reset decision');
        try {
          const response = await port.getUserGameState();
          if (response.success === false) throw new Error('Astrocade progress read failed');
        } catch (error) { return finish({ kind: 'not_saved', phase: 'reset_read', error }); }
        const initial = createInitialProgress();
        if (await write(initial, 'reset')) {
          progress = initial;
          protection = { kind: 'ready' };
          finish({ kind: 'reset' });
        }
        return snapshot();
      });
    }
  });
}
