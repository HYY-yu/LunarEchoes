import { validateDesertStory } from './desert-story.mjs';
export function embedDesertOpening(html, catalog) {
  const entries = validateDesertStory(catalog);
  const select = beat => {
    const { id, zh, en } = entries.find(entry => entry.beat === beat);
    return { id, zh, en };
  };
  const content = JSON.stringify({ opening: select('opening'), objective: select('objective') }).replaceAll('<', '\\u003c');
  const anchor = '<script id="desert-opening" type="application/json"></script>';
  if (!html.includes(anchor)) throw new Error('Missing desert opening content anchor');
  return html.replace(anchor, `<script id="desert-opening" type="application/json">${content}</script>`);
}
