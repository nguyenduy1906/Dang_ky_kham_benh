/**
 * appointment.js — Booking page helpers
 */

// ─── Sync date input khi chọn ca làm việc ─────────────────
(function () {
  const scheduleSelect = document.querySelector('select[name="schedule_id"]');
  const dateInput      = document.querySelector('input[name="appointment_date"]');
  const timeInput      = document.querySelector('input[name="appointment_time"]');

  if (!scheduleSelect) return;

  // Dữ liệu được nhúng từ server (nếu cần)
  scheduleSelect.addEventListener("change", function () {
    const option = this.options[this.selectedIndex];
    if (!option || !option.value) return;
    // Nếu option có data attributes (có thể thêm sau khi nâng cấp)
    const date = option.dataset?.date;
    const time = option.dataset?.time;
    if (date && dateInput) dateInput.value = date;
    if (time && timeInput) timeInput.value = time;
  });
})();

// ─── Prevent past dates ───────────────────────────────────
(function () {
  const today = new Date().toISOString().split("T")[0];
  document.querySelectorAll('input[type="date"]').forEach((el) => {
    if (!el.min) el.min = today;
  });
})();
