// Personal account fields supported by PATCH /me, shared by all profile pages.
export const personalFields = Object.freeze([
  { key: "dob", label: "Ngày sinh", type: "date" },
  { key: "gender", label: "Giới tính", type: "select" },
  { key: "id_card", label: "CCCD", type: "text", max: 12 },
  { key: "address", label: "Địa chỉ", type: "text", max: 255 },
  { key: "emergency_contact_name", label: "Người liên hệ khẩn cấp", type: "text", max: 150 },
  { key: "emergency_contact_phone", label: "Số điện thoại liên hệ khẩn cấp", type: "tel", max: 30 },
  { key: "emergency_contact_relationship", label: "Quan hệ với người liên hệ", type: "text", max: 50 },
]);

export const editableProfileKeys = Object.freeze(["full_name", "phone", "email", "dob", "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"]);

export function todayVN() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Saigon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function normalizeProfileValue(key, value) {
  let text = String(value ?? "").trim();
  if (key === "email") return text.toLowerCase();
  if (key === "phone" || key === "emergency_contact_phone") {
    text = text.replace(/[\s.\-]/g, "");
    if (/^\+?84[35789]\d{8}$/.test(text)) text = `0${text.replace(/^\+?84/, "")}`;
  }
  return text;
}

export function profileChanges(user, inputs) {
  const data = {};
  const allowed = [{ key: "full_name", label: "Họ và tên", max: 150 }, { key: "phone", label: "Số điện thoại" }, { key: "email", label: "Email", max: 254 }, ...personalFields];
  for (const field of allowed.filter(field => editableProfileKeys.includes(field.key))) {
    const { key, label, max } = field, input = inputs[key];
    if (!input) continue;
    input.setCustomValidity("");
    const value = normalizeProfileValue(key, input.value);
    if (value === normalizeProfileValue(key, user[key])) continue;
    let error = "";
    if (!value && ["full_name", "phone", "email"].includes(key)) error = `${label} không được để trống.`;
    else if (max && value.length > max) error = `${label} tối đa ${max} ký tự.`;
    else if (value && ["phone", "emergency_contact_phone"].includes(key) && !/^\+?\d{9,15}$/.test(value)) error = `${label} cần có từ 9 đến 15 chữ số.`;
    else if (key === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) error = "Vui lòng nhập email hợp lệ.";
    else if (key === "id_card" && value && !/^[0-9]{12}$/.test(value)) error = "CCCD phải gồm 12 chữ số.";
    else if (key === "gender" && value && !["Nam", "Nữ", "Khác"].includes(value)) error = "Vui lòng chọn giới tính hợp lệ.";
    else if (key === "dob" && value) {
      const parsed = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || value < "1900-01-01" || value > todayVN()) error = "Ngày sinh phải hợp lệ, từ 01/01/1900 đến hôm nay.";
    }
    input.setCustomValidity(error);
    data[key] = value || null;
  }
  return data;
}
