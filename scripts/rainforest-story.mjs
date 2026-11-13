const beats = [
  ['opening', 'any'],
  ['objective', 'any'],
  ['victory', 'won'],
  ['defeat', 'lost'],
  ['next-clue', 'won', 'antarctica']
];

function requireField(condition, field) {
  if (!condition) throw new Error(`Invalid rainforest story at ${field}`);
}

export function validateRainforestStory(input) {
  requireField(Array.isArray(input) && input.length === beats.length, '$');
  for (const [index, [beat, outcome, nextStageId]] of beats.entries()) {
    const entry = input[index];
    const path = `$[${index}]`;
    requireField(entry !== null && typeof entry === 'object' && !Array.isArray(entry), path);
    requireField(entry.id === `rainforest.${beat}`, `${path}.id`);
    requireField(entry.stageId === 'rainforest', `${path}.stageId`);
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
