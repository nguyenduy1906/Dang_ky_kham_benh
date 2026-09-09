/**
 * auth.js — Authentication form helpers
 */

// ─── Toggle Password Visibility ────────────────────────────
function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.type = field.type === "password" ? "text" : "password";
}

// ─── Password Strength Indicator ──────────────────────────
(function () {
  const pwField = document.getElementById("password");
  const indicator = document.getElementById("pwStrength");
  if (!pwField || !indicator) return;

  pwField.addEventListener("input", function () {
    const pw = this.value;
    let score = 0;
    if (pw.length >= 6)  score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;

    const levels = [
      { label: "", color: "" },
      { label: "Rất yếu", color: "#ef4444" },
      { label: "Yếu",     color: "#f97316" },
      { label: "Trung bình", color: "#eab308" },
      { label: "Mạnh",    color: "#22c55e" },
      { label: "Rất mạnh", color: "#16a34a" },
    ];
    const level = levels[Math.min(score, 5)];
    indicator.textContent = pw.length > 0 ? `Độ mạnh: ${level.label}` : "";
    indicator.style.color = level.color;
  });
})();

// ─── Confirm Password Match ────────────────────────────────
(function () {
  const form = document.getElementById("registerForm");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    const pw  = document.getElementById("password")?.value;
    const cpw = document.getElementById("confirm_password")?.value;
    if (pw && cpw && pw !== cpw) {
      e.preventDefault();
      alert("Mật khẩu xác nhận không khớp!");
    }
  });
})();
