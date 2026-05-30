"""Application configuration loaded from environment variables."""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with validation via Pydantic."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ---- Application ----
    APP_NAME: str = "Sbjiwala"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_URL: str = "http://localhost"
    APP_SECRET_KEY: str = "change-this-to-a-random-64-char-string"
    APP_ALLOWED_HOSTS: str = "localhost,127.0.0.1"

    # ---- PostgreSQL ----
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "sbjiwala"
    POSTGRES_USER: str = "sbjiwala"
    POSTGRES_PASSWORD: str = "password"
    DATABASE_URL: str = ""

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ---- Redis ----
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_URL: str = ""
    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""

    @property
    def redis_url(self) -> str:
        if self.REDIS_URL:
            return self.REDIS_URL
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    @property
    def celery_broker(self) -> str:
        if self.CELERY_BROKER_URL:
            return self.CELERY_BROKER_URL
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/1"

    @property
    def celery_backend(self) -> str:
        if self.CELERY_RESULT_BACKEND:
            return self.CELERY_RESULT_BACKEND
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/2"

    # ---- JWT ----
    JWT_SECRET_KEY: str = "change-this-jwt-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ---- Storage ----
    STORAGE_ROOT: str = "/app/storage"
    STORAGE_MAX_UPLOAD_SIZE_MB: int = 50
    STORAGE_ENCRYPTION_KEY: str = ""

    # ---- Email (SMTP) ----
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "Sbjiwala"
    SMTP_FROM_EMAIL: str = "noreply@sbjiwala.in"
    SMTP_USE_TLS: bool = True
    SMTP_START_TLS: bool = True

    # ---- SMS (MSG91) ----
    SMS_PROVIDER: str = "msg91"
    MSG91_AUTH_KEY: str = ""
    MSG91_SENDER_ID: str = "SABJWL"
    MSG91_TEMPLATE_ID: str = ""

    # ---- Push Notifications ----
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:admin@sbjiwala.in"

    # ---- Google OAuth2 ----
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost/api/v1/auth/google/callback"

    # ---- Facebook OAuth2 ----
    FACEBOOK_CLIENT_ID: str = ""
    FACEBOOK_CLIENT_SECRET: str = ""
    FACEBOOK_REDIRECT_URI: str = "http://localhost/api/v1/auth/facebook/callback"

    # ---- Razorpay ----
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # ---- PhonePe ----
    PHONEPE_MERCHANT_ID: str = ""
    PHONEPE_SALT_KEY: str = ""
    PHONEPE_SALT_INDEX: int = 1
    PHONEPE_ENV: str = "UAT"

    # ---- WhatsApp ----
    WHATSAPP_API_URL: str = ""
    WHATSAPP_API_KEY: str = ""

    # ---- OpenStreetMap / OSRM ----
    NOMINATIM_URL: str = "https://nominatim.openstreetmap.org"
    OSRM_URL: str = "http://router.project-osrm.org"
    NOMINATIM_USER_AGENT: str = "Sbjiwala/1.0"

    # ---- Rate Limiting ----
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_UPLOAD: str = "5/minute"

    # ---- CORS ----
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003"

    @property
    def CORS_ORIGINS_LIST(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    # ---- Frontend Ports ----
    CUSTOMER_APP_PORT: int = 3000
    VENDOR_APP_PORT: int = 3001
    DELIVERY_APP_PORT: int = 3002
    ADMIN_APP_PORT: int = 3003
    BACKEND_PORT: int = 8000

    # ---- Initial Admin ----
    INITIAL_ADMIN_EMAIL: str = "admin@sbjiwala.in"
    INITIAL_ADMIN_PASSWORD: str = "change-this-immediately"

    # ---- Geo Blocking ----
    GEO_BLOCK_ENABLED: bool = False
    GEO_ALLOWED_COUNTRIES: str = "IN"

    # ---- Logging ----
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"


settings = Settings()
