# Multi-stage build: build frontend, then bundle into backend image
# Build context must be the repo root (set dockerContext: . in render.yaml)
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
# Build with same-origin API URL (served by Flask on same port)
ENV VITE_API_URL=/api/v1
RUN npm run build

# ===== Backend stage =====
FROM python:3.11-slim

# System deps for psycopg2, matplotlib, shap
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libfreetype6-dev \
    libpng-dev \
    libffi-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy built frontend dist into the location expected by Flask (../frontend/dist relative to /app)
# /app is /app/backend in the original tree, so we put it at /frontend_dist
COPY --from=frontend-builder /frontend/dist /frontend/dist

# Create artifacts & reports directories
RUN mkdir -p /app/artifacts /app/artifacts/reports

# Expose port
EXPOSE 5000

# Environment
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV FLASK_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/api/v1/system/health || exit 1

# Run with gunicorn (single worker for free tier to reduce memory)
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:5000", "--timeout", "120", "--preload", "run:app"]
