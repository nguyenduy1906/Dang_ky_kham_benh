const MARGIN = 12;
export const LAUNCHER_SIZE = 64;

export function isChatPage(url, templates = new URL('../../../templates/', import.meta.url)) {
  const page = new URL(url);
  return ['public/', '(patient)/'].some(folder => {
    const base = new URL(folder, templates);
    return page.origin === base.origin && decodeURI(page.pathname).startsWith(decodeURI(base.pathname));
  });
}

export function chatLayout(position, width, height) {
  const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));
  const x = clamp(position.x, MARGIN, width - LAUNCHER_SIZE - MARGIN);
  const y = clamp(position.y, MARGIN, height - LAUNCHER_SIZE - MARGIN);
  const panelWidth = Math.max(0, Math.min(390, width - 2 * MARGIN));
  let panelHeight = Math.max(0, Math.min(620, height - LAUNCHER_SIZE - 3 * MARGIN));
  let left = x + LAUNCHER_SIZE - panelWidth;
  let top = y - panelHeight - MARGIN;
  if (top < MARGIN) {
    if (y + LAUNCHER_SIZE + MARGIN + panelHeight <= height - MARGIN) {
      top = y + LAUNCHER_SIZE + MARGIN;
    } else {
      // Beside the launcher when neither vertical side has enough room.
      const rightFits = x + LAUNCHER_SIZE + MARGIN + panelWidth <= width - MARGIN;
      const leftFits = x - MARGIN - panelWidth >= MARGIN;
      if (rightFits) left = x + LAUNCHER_SIZE + MARGIN;
      else if (leftFits) left = x - MARGIN - panelWidth;
      const above = y - 2 * MARGIN;
      const below = height - y - LAUNCHER_SIZE - 2 * MARGIN;
      if (!rightFits && !leftFits && Math.max(above, below) >= 360) {
        // On a phone, shorten the panel rather than cover its contents with the logo.
        panelHeight = Math.min(panelHeight, Math.max(above, below));
        top = below >= above ? y + LAUNCHER_SIZE + MARGIN : y - panelHeight - MARGIN;
      } else top = y + LAUNCHER_SIZE / 2 - panelHeight / 2;
    }
  }
  return {
    x, y, panelWidth, panelHeight,
    panelLeft: clamp(left, MARGIN, width - panelWidth - MARGIN),
    panelTop: clamp(top, MARGIN, height - panelHeight - MARGIN),
  };
}
