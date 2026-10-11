"""HTTP input validation and response handling."""
from flask import jsonify, request

from backend.app.middlewares.auth_middleware import current_user

from backend.app.validators.article_validator import parse_query, validate_article

from backend.app.services import article_service as service

def listing():
    return jsonify(service.listing(parse_query(request.args)))

def detail(slug):
    return jsonify(service.detail(slug))

def admin_list():
    return jsonify(service.listing(parse_query(request.args, admin=True), current_user()))

def create():
    return jsonify(service.create(current_user(), validate_article(request.get_json(silent=True)))), 201

def update(article_id):
    return jsonify(service.update(current_user(), article_id, validate_article(request.get_json(silent=True), partial=True)))
