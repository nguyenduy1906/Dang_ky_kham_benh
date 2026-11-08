"""Vietnamese text search shared by authorized, paginated model readers."""
import re
import unicodedata


def normalize_search(value):
    text = ''.join(c for c in unicodedata.normalize('NFD', str(value or ''))
                   if not unicodedata.combining(c)).lower().replace('đ', 'd')
    return re.sub(r'\b(bn|tk|bs)[\s_-]*0*(\d+)\b',
                  lambda m: f'{m[1]}_{int(m[2])}', text).strip()


def text_search(query, columns, codes):
    # columns and codes are static SQL expressions supplied by the model, never
    # user input. strpos keeps %, _, quotes and backslashes literal.
    clauses, values = [], []
    for term in normalize_search(query).split():
        code = re.fullmatch(r'(bn|tk|bs)_(\d+)', term)
        if code and code[1] in codes:
            clauses.append(f'({codes[code[1]]}=%s)')
            values.append(int(code[2]))
        else:
            parts = []
            for column in columns:
                normalized = (f"translate(regexp_replace(lower(normalize(COALESCE({column},''),NFD)), "
                              "'[\u0300-\u036f]', '', 'g'), 'đĐ','dd')")
                parts.append(f'strpos({normalized},%s)>0')
                values.append(term)
            clauses.append('(' + ' OR '.join(parts) + ')')
    return ' AND '.join(clauses) or 'TRUE', values
