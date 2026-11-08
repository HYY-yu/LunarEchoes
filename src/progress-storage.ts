import {
  createInitialProgress, decodeProgress, encodeProgress, isStageUnlocked,
  type CampaignProgress, type ProgressRejectionReason, type ProgressTransition
} from './progress.js';

export const PROGRESS_STORAGE_KEY = 'lunar-relay.campaign-progress';

export type ProgressStoragePort = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}>;

export type ProgressStorageProtection =
  | Readonly<{ kind: 'ready' }>
  | Readonly<{ kind: 'protected'; reason: ProgressRejectionReason }>
  | Readonly<{ kind: 'protected'; reason: 'read_error'; error: unknown }>;

export type ProgressStorageResult =
  | Readonly<{ kind: 'loaded'; source: 'missing' | 'valid' }>
  | Readonly<{ kind: 'recovery_required'; phase: 'load' | 'save_read'; reason: ProgressRejectionReason }>
  | Readonly<{ kind: 'not_saved'; phase: 'load' | 'save_read' | 'save_write' | 'reset_read' | 'reset_write'; error: unknown }>
  | Readonly<{ kind: 'uncertain'; phase: 'save_verify' | 'reset_verify'; reason: 'read_error'; error: unknown }>
  | Readonly<{ kind: 'uncertain'; phase: 'save_verify' | 'reset_verify'; reason: 'mismatch' }>
  | Readonly<{ kind: 'saved' | 'reset' | 'cancelled' | 'unchanged' | 'protected' }>;

export type ProgressStorageSnapshot = Readonly<{
  progress: CampaignProgress;
  protection: ProgressStorageProtection;
  result: ProgressStorageResult;
}>;

export type ProgressStorage = Readonly<{
  snapshot(): ProgressStorageSnapshot;
  saveAdvanced(transition: Extract<ProgressTransition, { kind: 'advanced' }>): ProgressStorageSnapshot;
  reset(decision: 'confirmed' | 'cancelled'): ProgressStorageSnapshot;
}>;

export function openProgressStorage(storage: ProgressStoragePort): ProgressStorage {
  let progress = createInitialProgress();
  let protection: ProgressStorageProtection = Object.freeze({ kind: 'ready' });
  let result: ProgressStorageResult = Object.freeze({ kind: 'loaded', source: 'missing' });
  const snapshot = (): ProgressStorageSnapshot => Object.freeze({ progress, protection, result });
  function finish(next: ProgressStorageResult): ProgressStorageSnapshot {
    result = Object.freeze(next);
    return snapshot();
  }
  function read(phase: 'load' | 'save_read') {
    let raw: string | null;
    try {
      raw = storage.getItem(PROGRESS_STORAGE_KEY);
    } catch (error) {
      protection = Object.freeze({ kind: 'protected', reason: 'read_error', error } satisfies ProgressStorageProtection);
      finish({ kind: 'not_saved', phase, error });
      return null;
    }
    const decoded = decodeProgress(raw);
    if (decoded.kind === 'rejected') {
      protection = Object.freeze({ kind: 'protected', reason: decoded.reason });
      finish({ kind: 'recovery_required', phase, reason: decoded.reason });
    }
    return decoded;
  }
  function write(target: CampaignProgress, operation: 'save' | 'reset'): boolean {
    const expected = encodeProgress(target);
    try {
      storage.setItem(PROGRESS_STORAGE_KEY, expected);
    } catch (error) {
      finish({ kind: 'not_saved', phase: operation === 'save' ? 'save_write' : 'reset_write', error });
      return false;
    }
    const phase = operation === 'save' ? 'save_verify' : 'reset_verify';
    let actual: string | null;
    try {
      actual = storage.getItem(PROGRESS_STORAGE_KEY);
    } catch (error) {
      finish({ kind: 'uncertain', phase, reason: 'read_error', error });
      return false;
    }
    if (actual !== expected) {
      finish({ kind: 'uncertain', phase, reason: 'mismatch' });
      return false;
    }
    return true;
  }
  const loaded = read('load');
  if (loaded?.kind === 'valid') {
    progress = loaded.progress;
    finish({ kind: 'loaded', source: 'valid' });
  }
  return Object.freeze({
    snapshot,
    saveAdvanced(transition: Extract<ProgressTransition, { kind: 'advanced' }>) {
      if (transition.kind !== 'advanced') throw new TypeError('Expected an advanced progress transition');
      const candidate = transition.progress;
      if (isStageUnlocked({ progress, stageId: candidate.highestUnlockedStageId })) return finish({ kind: 'unchanged' });
      progress = Object.freeze({ version: 1, highestUnlockedStageId: candidate.highestUnlockedStageId });
      if (protection.kind === 'protected') return finish({ kind: 'protected' });
      const previous = read('save_read');
      if (previous === null || previous.kind === 'rejected') return snapshot();
      if (previous.kind === 'valid' && isStageUnlocked({ progress: previous.progress, stageId: progress.highestUnlockedStageId })) progress = previous.progress;
      if (write(progress, 'save')) finish({ kind: 'saved' });
      return snapshot();
    },
    reset(decision: 'confirmed' | 'cancelled') {
      if (decision === 'cancelled') return finish({ kind: 'cancelled' });
      if (decision !== 'confirmed') throw new TypeError('Expected an explicit reset decision');
      try {
        storage.getItem(PROGRESS_STORAGE_KEY);
      } catch (error) {
        return finish({ kind: 'not_saved', phase: 'reset_read', error });
      }
      const initial = createInitialProgress();
      if (write(initial, 'reset')) {
        progress = initial;
        protection = Object.freeze({ kind: 'ready' });
        finish({ kind: 'reset' });
      }
      return snapshot();
    }
  });
}
