export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Reveal complete Unicode characters; cap duration so a long answer stays readable.
export async function revealText(text, {
  write, wait = pause, now = () => performance.now(),
  instant = () => false,
} = {}) {
  text = String(text ?? '');
  const characters = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text), part => part.segment)
    : Array.from(text);
  if (!characters.length || instant()) { write(text); return; }
  const duration = Math.min(5500, Math.max(350, characters.length / 95 * 1000));
  const started = now();
  let count = 0;
  while (count < characters.length) {
    if (instant()) { write(text); return; }
    count = Math.min(characters.length, Math.max(count + 1, Math.floor((now() - started) / duration * characters.length)));
    write(characters.slice(0, count).join(''));
    if (count < characters.length) await wait(24);
  }
}
