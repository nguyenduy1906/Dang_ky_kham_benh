// Keep text searches responsive without firing a request for every IME keystroke.
export function bindLiveSearch(input, search, { invalidate = () => {}, delay = 250 } = {}) {
  let timer, composing = false, active = true;
  function clear() { clearTimeout(timer); invalidate(); }
  function refresh() {
    if (!active) return;
    clear();
    return search();
  }
  function queue(event) {
    if (!active) return;
    clear();
    if (!composing && !event.isComposing) timer = setTimeout(refresh, delay);
  }
  input.addEventListener("input", queue);
  input.addEventListener("compositionstart", () => { composing = true; clear(); });
  input.addEventListener("compositionend", event => { composing = false; queue(event); });
  function stop() { active = false; clear(); }
  window.addEventListener("pagehide", stop, { once: true });
  window.addEventListener("neu:auth-change", stop, { once: true });
  refresh.cancel = () => clearTimeout(timer);
  return refresh;
}
