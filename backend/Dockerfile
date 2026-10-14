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
CMD ["python", "-m", "backend.app.utils.server"]
