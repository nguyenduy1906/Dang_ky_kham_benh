import { code } from "./business_codes.js";
import { qrcodegen } from "../vendor/qrcodegen.js";

// The current backend issues DEMO transactions, not bank transfer destinations.
// Encode only the transaction reference and server amount; never patient data.
export function demoPaymentPayload(payment) {
  if (payment?.transaction_status !== "PENDING" || !/^(?:DEMO-[a-f0-9]{32}|GD_DEMO_\d{8}_\d{6,})$/i.test(payment.transaction_code || "")) return null;
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return JSON.stringify({ mode: "DEMO", transaction: payment.transaction_code, amount, currency: "VND" });
}

export function qrMatrix(text) {
  const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM);
  return Array.from({ length: qr.size }, (_, y) => Array.from({ length: qr.size }, (_, x) => qr.getModule(x, y)));
}

function qrImage(payload, label) {
  const matrix = qrMatrix(payload), size = matrix.length + 8;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  svg.setAttribute("shape-rendering", "crispEdges");
  const background = document.createElementNS(svg.namespaceURI, "rect");
  background.setAttribute("width", size); background.setAttribute("height", size); background.setAttribute("fill", "white");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("fill", "#172d28");
  path.setAttribute("d", matrix.flatMap((row, y) => row.flatMap((dark, x) => dark ? [`M${x + 4},${y + 4}h1v1h-1z`] : [])).join(""));
  svg.append(background, path);
  return svg;
}

export function renderDemoQr(target, payment) {
  target.replaceChildren();
  const payload = demoPaymentPayload(payment);
  target.hidden = !payload;
  if (!payload) return;
  const svg = qrImage(payload, "QR đối chiếu giao dịch trên hệ thống");
  const info = document.createElement("div");
  const heading = document.createElement("strong"); heading.textContent = "Thông tin giao dịch";
  const amount = document.createElement("p"); amount.className = "booking-qr-amount";
  amount.textContent = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(payment.amount));
  const reference = document.createElement("p"); reference.textContent = `Mã giao dịch: ${payment.transaction_code || code("TT", payment.payment_id)}`;
  const note = document.createElement("p"); note.textContent = "QR dùng để đối chiếu giao dịch. Không sử dụng mã này để chuyển khoản ngân hàng.";
  info.append(heading, amount, reference, note); target.append(svg, info);
}
