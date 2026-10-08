FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt && useradd --create-home appuser \
    && mkdir -p /app/uploads/avatars && chown -R appuser /app/uploads
COPY backend backend
COPY database database
USER appuser
EXPOSE 5000
CMD ["sh", "-c", "python -m backend.app.db.init_db && python -m backend.app.db.seed_db && exec gunicorn --bind 0.0.0.0:5000 --workers 2 --access-logfile - --error-logfile - 'backend.app.main:create_app()'"]
