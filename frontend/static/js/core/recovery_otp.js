// The code must come from the explicitly enabled backend demo, never be invented here.
export function startOtpAutofill({ code, onTick, onFill, schedule = setTimeout, cancel = clearTimeout }) {
  if (!/^\d{6}$/.test(code)) throw new Error('Mã OTP demo không hợp lệ.');
  let remaining = 5, timer, stopped = false;
  function tick() {
    if (stopped) return;
    onTick(remaining);
    if (!remaining) { onFill(code); return; }
    timer = schedule(() => { remaining--; tick(); }, 1000);
  }
  tick();
  return () => { stopped = true; cancel(timer); };
}
