import { STAGE_ORDER, type StageId } from './stage-contract.js';

export type CampaignProgress = Readonly<{
  version: 1;
  highestUnlockedStageId: StageId;
}>;

export type ProgressTransition =
  | Readonly<{ kind: 'locked' }>
  | Readonly<{ kind: 'unchanged' }>
  | Readonly<{ kind: 'advanced'; progress: CampaignProgress }>;

export type ProgressRejectionReason = 'invalid_json' | 'invalid_type'
  | 'invalid_version' | 'unknown_version' | 'invalid_fields' | 'unknown_stage';

export type ProgressDecodeResult =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'valid'; progress: CampaignProgress }>
  | Readonly<{ kind: 'rejected'; reason: ProgressRejectionReason; raw: string }>;

export function decodeProgress(raw: string | null): ProgressDecodeResult {
  if (raw === null) return { kind: 'missing' };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { kind: 'rejected', reason: 'invalid_json', raw };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { kind: 'rejected', reason: 'invalid_type', raw };
  }
  if (!('version' in value) || typeof value.version !== 'number' || !Number.isInteger(value.version)) {
    return { kind: 'rejected', reason: 'invalid_version', raw };
  }
  if (value.version !== 1) return { kind: 'rejected', reason: 'unknown_version', raw };
  if (Object.keys(value).length !== 2 || !('highestUnlockedStageId' in value)) {
    return { kind: 'rejected', reason: 'invalid_fields', raw };
  }
  if (typeof value.highestUnlockedStageId !== 'string') {
    return { kind: 'rejected', reason: 'invalid_type', raw };
  }
  for (const id of STAGE_ORDER) {
    if (value.highestUnlockedStageId === id) {
      return { kind: 'valid', progress: Object.freeze({ version: 1, highestUnlockedStageId: id }) };
    }
  }
  return { kind: 'rejected', reason: 'unknown_stage', raw };
}

export function encodeProgress(progress: CampaignProgress): string {
  return JSON.stringify({ version: 1, highestUnlockedStageId: progress.highestUnlockedStageId });
}

export function createInitialProgress(): CampaignProgress {
  return Object.freeze({ version: 1, highestUnlockedStageId: STAGE_ORDER[0] });
}

export function isStageUnlocked(input: Readonly<{ progress: CampaignProgress; stageId: StageId }>): boolean {
  return STAGE_ORDER.indexOf(input.stageId) <= STAGE_ORDER.indexOf(input.progress.highestUnlockedStageId);
}

export function applyStageResult(input: Readonly<{
  progress: CampaignProgress;
  stageId: StageId;
  source: 'live' | 'replay';
  outcome: 'won' | 'lost';
}>): ProgressTransition {
  const { progress, stageId, source, outcome } = input;
  if (source !== 'live' && source !== 'replay') throw new TypeError('Invalid stage result source');
  if (outcome !== 'won' && outcome !== 'lost') throw new TypeError('Invalid stage result outcome');
  if (!isStageUnlocked({ progress, stageId })) return { kind: 'locked' };
  if (source !== 'live' || outcome !== 'won') return { kind: 'unchanged' };
  const nextStageId = STAGE_ORDER[STAGE_ORDER.indexOf(stageId) + 1];
  if (nextStageId === undefined || isStageUnlocked({ progress, stageId: nextStageId })) return { kind: 'unchanged' };
  return { kind: 'advanced', progress: Object.freeze({ version: 1, highestUnlockedStageId: nextStageId }) };
}
