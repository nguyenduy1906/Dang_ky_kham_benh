export function normalizeSearchText(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu,'')
    .replace(/[đĐ]/g,'d').toLowerCase()
    .replace(/\b(bn|tk|bs|lk|ca|ph|pc|tt|dg|np|bv|ck|nk)[\s_-]*0*(\d+)\b/g,(_,prefix,id)=>`${prefix}_${Number(id)}`)
    .replace(/\s+/g,' ').trim();
}

export function matchesSearch(text, query) {
  const content=normalizeSearchText(text);
  return normalizeSearchText(query).split(' ').filter(Boolean).every(term=>{
    if(/^(bn|tk|bs|lk|ca|ph|pc|tt|dg|np|bv|ck|nk)_\d+$/.test(term)) {
      return new RegExp(`\\b${term}\\b`).test(content);
    }
    return content.includes(term);
  });
}
