// Return only to known public/patient pages within this application.
export function profileReturnUrl(current, referrer, saved) {
  const profile = new URL(current);
  const templates = new URL('../', profile);
  const fallback = new URL('public/home.html', templates);
  const allowed = {
    public: ['home', 'about', 'departments', 'department_detail', 'doctors', 'doctor_detail', 'news', 'article', 'contact'],
    '(patient)': ['portal', 'booking', 'booking_review', 'payment', 'appointments', 'records', 'chemotherapy'],
  };
  for (const value of [saved, referrer]) {
    if (!value) continue;
    try {
      const url = new URL(value, profile);
      if (url.origin !== profile.origin || url.username || url.password) continue;
      const relative = decodeURIComponent(url.pathname).slice(decodeURIComponent(templates.pathname).length);
      if (!decodeURIComponent(url.pathname).startsWith(decodeURIComponent(templates.pathname))) continue;
      if (Object.entries(allowed).some(([folder, files]) => files.some(file => relative === `${folder}/${file}.html`))) return url;
    } catch { /* Ignore invalid or external return destinations. */ }
  }
  return fallback;
}
