"""Shared SQL insert and update helpers."""


def update_row(db, table, pk_column, pk_value, fields, allowed):
    """UPDATE các cột nằm trong danh sách cho phép (tên bảng/cột do code quyết định)."""
    cols = [c for c in fields if c in allowed]
    if not cols:
        return db.execute(f'SELECT * FROM {table} WHERE {pk_column} = %s', (pk_value,)).fetchone()
    assignments = ', '.join(f'{c} = %s' for c in cols)
    return db.execute(f'UPDATE {table} SET {assignments} WHERE {pk_column} = %s RETURNING *',
                      [fields[c] for c in cols] + [pk_value]).fetchone()


def insert_row(db, table, fields, allowed):
    cols = [c for c in allowed if c in fields]
    placeholders = ', '.join(['%s'] * len(cols))
    return db.execute(f'INSERT INTO {table} ({", ".join(cols)}) VALUES ({placeholders}) RETURNING *',
                      [fields[c] for c in cols]).fetchone()
