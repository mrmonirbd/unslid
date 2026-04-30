import logging
import logging.config
import os
import time
import uuid
import sentry_sdk
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pythonjsonlogger import jsonlogger

# ── Structured JSON logging ───────────────────────────────────────────────────
def _configure_logging():
    handler = logging.StreamHandler()
    environment = os.getenv("ENVIRONMENT", "development")
    if environment == "production":
        formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(name)s %(levelname)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
    else:
        formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    handler.setFormatter(formatter)
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    # Silence noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

_configure_logging()
logger = logging.getLogger(__name__)

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

from api.lifespan import app_lifespan
from api.middlewares import PlanAIConfigMiddleware
from api.v1.ppt.router import API_V1_PPT_ROUTER
from api.v1.webhook.router import API_V1_WEBHOOK_ROUTER
from api.v1.mock.router import API_V1_MOCK_ROUTER
from api.v1.jobs.router import JOBS_ROUTER
from api.v1.billing.router import BILLING_ROUTER, WEBHOOK_ROUTER
from api.v1.account.router import ACCOUNT_ROUTER
from api.v1.account.share_viewer import SHARE_VIEWER_ROUTER
from api.v1.org.router import ORG_ROUTER
from api.v1.admin.router import ADMIN_ROUTER
from api.v1.admin.pptx_templates_router import (
    PPTX_TEMPLATES_ROUTER,
    PUBLIC_PPTX_TEMPLATES_ROUTER,
    THUMB_ROUTER,
)
from utils.get_env import get_app_data_directory_env
from api.v1.dev.email_preview import EMAIL_PREVIEW_ROUTER
from fastapi.staticfiles import StaticFiles
import pathlib

# Sentry — only initialised if DSN is configured
SENTRY_DSN = os.getenv("SENTRY_DSN", "") or os.getenv("SENTRY_DSN_FASTAPI", "")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=os.getenv("ENVIRONMENT", "development"),
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )


app = FastAPI(lifespan=app_lifespan)

# Attach rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    """Liveness probe — returns 200 when the server is up."""
    return {"status": "ok"}


# ── Request ID + timing middleware ────────────────────────────────────────────
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    start = time.perf_counter()
    response: Response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000)
    response.headers["X-Request-ID"] = request_id
    if os.getenv("ENVIRONMENT") == "production":
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            },
        )
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Log 422 validation errors clearly and return a readable message."""
    errors = exc.errors()
    logger.error("422 Validation Error on %s %s: %s", request.method, request.url.path, errors)
    # Build a human-readable summary
    messages = []
    for err in errors:
        loc = " → ".join(str(x) for x in err.get("loc", []))
        msg = err.get("msg", "")
        messages.append(f"{loc}: {msg}")
    detail = "; ".join(messages) if messages else "Validation failed"
    return JSONResponse(status_code=422, content={"detail": detail})


# Routers
app.include_router(API_V1_PPT_ROUTER)
app.include_router(API_V1_WEBHOOK_ROUTER)
# Dev-only endpoints — stripped out in production
if os.getenv("ENVIRONMENT", "development") == "development":
    app.include_router(API_V1_MOCK_ROUTER)
    app.include_router(EMAIL_PREVIEW_ROUTER)
app.include_router(JOBS_ROUTER, prefix="/api/v1")
app.include_router(BILLING_ROUTER, prefix="/api/v1")
app.include_router(WEBHOOK_ROUTER, prefix="/api/v1")
app.include_router(ACCOUNT_ROUTER, prefix="/api/v1")
app.include_router(SHARE_VIEWER_ROUTER, prefix="/api/v1")
app.include_router(ORG_ROUTER, prefix="/api/v1")
app.include_router(ADMIN_ROUTER, prefix="/api/v1")
app.include_router(PPTX_TEMPLATES_ROUTER)
app.include_router(PUBLIC_PPTX_TEMPLATES_ROUTER)
app.include_router(THUMB_ROUTER)

# Serve generated images and other app_data assets used by the Next.js rewrite.
_app_data_dir = pathlib.Path(get_app_data_directory_env())
_app_data_dir.mkdir(parents=True, exist_ok=True)
app.mount("/app_data", StaticFiles(directory=str(_app_data_dir)), name="app-data")

# Brand logo static files
_logo_dir = pathlib.Path("/app_data/brand_logos")
_logo_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/v1/brand-logo", StaticFiles(directory=str(_logo_dir)), name="brand-logos")

# CORS — restricted to APP_DOMAIN only (not wildcard)
app_domain = os.getenv("APP_DOMAIN", "localhost")
environment = os.getenv("ENVIRONMENT", "development")

if environment == "development":
    allowed_origins = [
        "http://localhost",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
else:
    allowed_origins = [
        f"https://{app_domain}",
        f"http://{app_domain}",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Plan-based AI config — must run AFTER CORS so auth header is accessible
app.add_middleware(PlanAIConfigMiddleware)
