"""Allow the configured frontend origins to call the existing Bearer APIs."""
import os
from flask import request

DEFAULT_FRONTEND_ORIGINS = (
    'http://127.0.0.1:3000,http://localhost:3000,'
    'http://127.0.0.1:5500,http://localhost:5500'
)


def register_cors(app):
    origins = {origin.strip() for origin in os.environ.get(
        'FRONTEND_ORIGINS', DEFAULT_FRONTEND_ORIGINS).split(',') if origin.strip()}

    @app.after_request
    def frontend_cors(response):
        # Also cover validation/auth errors and Flask's automatic OPTIONS replies.
        response.vary.add('Origin')
        if request.headers.get('Origin') in origins:
            response.headers['Access-Control-Allow-Origin'] = request.headers['Origin']
            if request.method == 'OPTIONS':
                response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, POST, PATCH, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
                response.headers['Access-Control-Max-Age'] = '600'
        return response
