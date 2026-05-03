FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y \
    curl \
    libreoffice \
    fontconfig \
    chromium \
    zstd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV APP_DATA_DIRECTORY=/app_data
ENV TEMP_DIRECTORY=/tmp/presenton
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Core dependencies (fast to install)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir \
    alembic aiohttp aiomysql aiosqlite \
    fastapi[standard] pathvalidate pdfplumber \
    sqlmodel anthropic google-genai openai \
    dirtyjson arq redis \
    python-jose[cryptography] httpx aioboto3 \
    stripe sentry-sdk[fastapi] python-multipart \
    slowapi python-json-logger

# Heavy ML dependency (cached separately so layer is only rebuilt if it changes)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir \
    chromadb fastmcp \
    docling \
    --extra-index-url https://download.pytorch.org/whl/cpu

COPY . .

EXPOSE 8000

CMD ["python", "server.py", "--port", "8000"]
