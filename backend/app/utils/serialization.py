"""Convert database values into JSON-compatible values."""
from datetime import date, datetime, time
from decimal import Decimal


def jsonable(value):
    """Chuyển date/time/Decimal thành kiểu JSON được."""
    if isinstance(value, dict):
        return {k: jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral() else float(value)
    return value


def flags(row, *keys):
    """Đổi các cột 0/1 thành true/false."""
    out = dict(row)
    for key in keys:
        if key in out:
            out[key] = bool(out[key])
    return out
