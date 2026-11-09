import { validateDesertStory } from './desert-story.mjs';
export function embedDesertContent(html, catalog) {
  const entries = validateDesertStory(catalog);
  const select = beat => {
    const { id, zh, en } = entries.find(entry => entry.beat === beat);
    return { id, zh, en };
  };
  const content = JSON.stringify({ opening: select('opening'), objective: select('objective'), defeat: select('defeat'), victory: select('victory'), nextClue: select('next-clue') }).replaceAll('<', '\\u003c');
  const anchor = '<script id="desert-content" type="application/json"></script>';
  if (!html.includes(anchor)) throw new Error('Missing desert content anchor');
  return html.replace(anchor, () => `<script id="desert-content" type="application/json">${content}</script>`);
}
