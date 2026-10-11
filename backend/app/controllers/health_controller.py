"""HTTP input validation and response handling."""
from flask import jsonify

from backend.app.services.health_service import check_health

def health():
    return jsonify(check_health())
