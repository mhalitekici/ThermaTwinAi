FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/app/backend APP_ENV=production PORT=8000
WORKDIR /app
COPY deploy/api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --require-hashes -r /app/requirements.txt \
    && useradd --uid 10001 --create-home app
COPY backend/thermatwin /app/backend/thermatwin
COPY public/*.json /app/public/
COPY scripts/smoke_api_runtime.py /app/smoke_api_runtime.py
USER app
EXPOSE 8000
CMD ["sh", "-c", "exec uvicorn thermatwin.api:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]
