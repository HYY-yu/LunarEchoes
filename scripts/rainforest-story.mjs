const beats = [
  ['opening', 'any'],
  ['objective', 'any'],
  ['victory', 'won'],
  ['defeat', 'lost']
];

function validateStageStory(input, stageId, nextStage) {
  function requireField(condition, field) {
    if (!condition) throw new Error(`Invalid ${stageId} story at ${field}`);
  }
  const stageBeats = nextStage ? [...beats, ['next-clue', 'won', nextStage]] : beats;
  requireField(Array.isArray(input) && input.length === stageBeats.length, '$');
  for (const [index, [beat, outcome, nextStageId]] of stageBeats.entries()) {
    const entry = input[index];
    const path = `$[${index}]`;
    requireField(entry !== null && typeof entry === 'object' && !Array.isArray(entry), path);
    requireField(entry.id === `${stageId}.${beat}`, `${path}.id`);
    requireField(entry.stageId === stageId, `${path}.stageId`);
    requireField(entry.beat === beat, `${path}.beat`);
    requireField(entry.outcome === outcome, `${path}.outcome`);
    if (nextStageId) requireField(entry.nextStageId === nextStageId, `${path}.nextStageId`);
    else requireField(!Object.hasOwn(entry, 'nextStageId'), `${path}.nextStageId`);
    for (const locale of ['zh', 'en']) {
      requireField(typeof entry[locale] === 'string' && entry[locale].trim().length > 0, `${path}.${locale}`);
    }
    const keys = ['id', 'stageId', 'beat', 'outcome', 'zh', 'en', ...(nextStageId ? ['nextStageId'] : [])];
    requireField(Object.keys(entry).every(key => keys.includes(key)), path);
  }
  return input;
}

export function validateRainforestStory(input) {
  return validateStageStory(input, 'rainforest', 'antarctica');
}

export function validateLaterStory(input) {
  if (!Array.isArray(input) || input.length !== 19) throw new Error('Expected 19 later campaign story entries');
  const stages = ['antarctica', 'space-elevator', 'watchtower', 'lunar-echoes'];
  return stages.flatMap((stage, index) => validateStageStory(input.slice(index * 5, (index + 1) * 5), stage, stages[index + 1]));
}
