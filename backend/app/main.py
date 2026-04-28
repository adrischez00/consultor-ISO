import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.audit_reports import router as audit_reports_router
from app.api.routes.clients import router as clients_router
from app.api.routes.customer_feedback import router as customer_feedback_router
from app.api.routes.diagnostics import router as diagnostics_router
from app.api.routes.health import router as health_router
from app.api.routes.iso_flow import router as iso_flow_router
from app.api.routes.iso_management import router as iso_management_router
from app.api.routes.kpis import router as kpis_router
from app.api.routes.management_reviews import router as management_reviews_router
from app.api.routes.questions import router as questions_router
from app.api.routes.risk_opportunities import router as risk_opportunities_router
from app.api.routes.suppliers import router as suppliers_router
from app.core.config import ENV_FILE_PATH, get_settings

settings = get_settings()
logging.basicConfig(
    level=logging.DEBUG if settings.app_debug else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name, debug=settings.app_debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(questions_router)
app.include_router(auth_router)
app.include_router(audit_reports_router)
app.include_router(diagnostics_router)
app.include_router(clients_router)
app.include_router(customer_feedback_router)
app.include_router(iso_flow_router)
app.include_router(iso_management_router)
app.include_router(kpis_router)
app.include_router(management_reviews_router)
app.include_router(risk_opportunities_router)
app.include_router(suppliers_router)

logger.info("Application initialized with CORS origins: %s", settings.cors_origins_list)
logger.info("Settings env file path: %s", ENV_FILE_PATH)
logger.info(
    "Database target configured: user=%s host=%s port=%s mode=%s",
    settings.database_username,
    settings.database_host,
    settings.database_port,
    settings.database_mode,
)
logger.debug("Database URL (redacted): %s", settings.database_url_redacted)
