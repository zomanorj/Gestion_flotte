# Backend FastAPI + Socket.io
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UPLOADS_DIR=/app/uploads

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY main.py alembic.ini ./
COPY app ./app
COPY migrations ./migrations
COPY donnees ./donnees

# Utilisateur non-root ; uploads/ est monté en volume par docker compose
RUN useradd --create-home flotte && mkdir -p uploads/documents && chown -R flotte:flotte uploads
USER flotte

EXPOSE 5000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')"

# --proxy-headers : IP réelle du client derrière nginx (limitation des tentatives de connexion)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000", "--proxy-headers"]
