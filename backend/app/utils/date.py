"""Tiện ích thời gian: múi giờ Việt Nam (UTC+7), không cần tzdata trong image."""
from datetime import datetime, timedelta, timezone

VN_TZ = timezone(timedelta(hours=7))

def today_vn():
    return datetime.now(VN_TZ).date()
