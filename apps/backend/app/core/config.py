"""Application configuration loaded from environment variables."""
from typing import List, Optional
from pydantic import Field, AliasChoices
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
    POSTGRES_HOST: str = Field(default="localhost", validation_alias=AliasChoices("DATABASE_HOST", "POSTGRES_HOST"))
    POSTGRES_PORT: int = Field(default=5432, validation_alias=AliasChoices("DATABASE_PORT", "POSTGRES_PORT"))
    POSTGRES_DB: str = Field(default="sbjiwala", validation_alias=AliasChoices("DATABASE_DB", "POSTGRES_DB"))
    POSTGRES_USER: str = Field(default="sbjiwala", validation_alias=AliasChoices("DATABASE_USER", "POSTGRES_USER"))
    POSTGRES_PASSWORD: str = Field(default="password", validation_alias=AliasChoices("DATABASE_PASSWORD", "POSTGRES_PASSWORD"))
    DATABASE_SSL: str = Field(default="disable", validation_alias=AliasChoices("DATABASE_SSL", "POSTGRES_SSL"))
    DATABASE_URL: str = Field(default="", validation_alias=AliasChoices("DATABASE_URL"))

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        ssl_arg = f"?ssl={self.DATABASE_SSL}" if self.DATABASE_SSL != "disable" else ""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}{ssl_arg}"
        )

    # ---- Redis ----
    REDIS_HOST: str = Field(default="localhost", validation_alias=AliasChoices("REDIS_HOST"))
    REDIS_PORT: int = Field(default=6379, validation_alias=AliasChoices("REDIS_PORT"))
    REDIS_PASSWORD: str = Field(default="", validation_alias=AliasChoices("REDIS_PASSWORD"))
    REDIS_SSL: bool = Field(default=False, validation_alias=AliasChoices("REDIS_SSL"))
    REDIS_URL: str = Field(default="", validation_alias=AliasChoices("REDIS_URL"))
    CELERY_BROKER_URL: str = Field(default="", validation_alias=AliasChoices("CELERY_BROKER_URL"))
    CELERY_RESULT_BACKEND: str = Field(default="", validation_alias=AliasChoices("CELERY_RESULT_BACKEND"))

    def _assemble_redis_uri(self, db_index: int = 0) -> str:
        protocol = "rediss" if self.REDIS_SSL else "redis"
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        ssl_params = "?ssl_cert_reqs=none" if self.REDIS_SSL else ""
        return f"{protocol}://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{db_index}{ssl_params}"

    @property
    def redis_url(self) -> str:
        if self.REDIS_URL:
            return self.REDIS_URL
        return self._assemble_redis_uri(db_index=0)

    @property
    def celery_broker(self) -> str:
        if self.CELERY_BROKER_URL:
            return self.CELERY_BROKER_URL
        return self._assemble_redis_uri(db_index=1)

    @property
    def celery_backend(self) -> str:
        if self.CELERY_RESULT_BACKEND:
            return self.CELERY_RESULT_BACKEND
        return self._assemble_redis_uri(db_index=2)

    # ---- JWT ----
    JWT_SECRET_KEY: str = "change-this-jwt-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ---- Storage ----
    STORAGE_ROOT: str = "/app/storage"
    STORAGE_MAX_UPLOAD_SIZE_MB: int = 50
    STORAGE_ENCRYPTION_KEY: str = ""
    UI_DIR: Optional[str] = None

    # ---- Email (SMTP) ----
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "Sbjiwala"
    SMTP_FROM_EMAIL: str = "noreply@sbjiwala.qzz.io"
    SMTP_USE_TLS: bool = True
    SMTP_START_TLS: bool = True

    # ---- SMS (MSG91) ----
    SMS_PROVIDER: str = "msg91"
    MSG91_AUTH_KEY: str = ""
    MSG91_SENDER_ID: str = "SABJWL"
    MSG91_TEMPLATE_ID: str = ""
    SMS_GATEWAY_URL: Optional[str] = None
    SMS_GATEWAY_KEY: Optional[str] = None
    SMS_SENDER_ID: str = "SABJWL"

    # ---- Push Notifications ----
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:admin@sbjiwala.qzz.io"
    FCM_SERVER_KEY: Optional[str] = None
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = None

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

    # ---- Cashfree ----
    CASHFREE_APP_ID: str = ""
    CASHFREE_SECRET_KEY: str = ""
    CASHFREE_ENV: str = "sandbox"  # sandbox | production

    @property
    def cashfree_enabled(self) -> bool:
        """Returns True only if both Cashfree credentials are configured."""
        return bool(self.CASHFREE_APP_ID and self.CASHFREE_SECRET_KEY)

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
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,"
        "http://localhost:8000,http://localhost:8080,http://localhost,"
        "https://localhost,https://localhost:3000,https://localhost:3001,"
        "capacitor://localhost,ionic://localhost,"
        "http://10.0.2.2,http://10.0.2.2:3000,http://10.0.2.2:8000,"
        "http://10.0.3.2,http://10.0.3.2:3000,http://10.0.3.2:8000,"
        "https://app.sbjiwala.in,https://vendor.sbjiwala.in,https://delivery.sbjiwala.in,https://admin.sbjiwala.in,"
        "http://sbjiwala.qzz.io,https://sbjiwala.qzz.io"
    )

    @property
    def CORS_ORIGINS_LIST(self) -> List[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        # Add null origin for packaged Android/iOS apps
        if "null" not in origins:
            origins.append("null")
        return origins

    # ---- Frontend Ports ----
    CUSTOMER_APP_PORT: int = 3000
    VENDOR_APP_PORT: int = 3001
    DELIVERY_APP_PORT: int = 3002
    ADMIN_APP_PORT: int = 3003
    BACKEND_PORT: int = 8000

    # ---- Initial Admin ----
    INITIAL_ADMIN_EMAIL: str = "admin@sbjiwala.qzz.io"
    INITIAL_ADMIN_PASSWORD: str = "change-this-immediately"

    # ---- Geo Blocking ----
    GEO_BLOCK_ENABLED: bool = False
    GEO_ALLOWED_COUNTRIES: str = "IN"

    # ---- Logging ----
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"


settings = Settings()


async def apply_system_settings_overrides(db) -> None:
    """Load settings from the database and override the in-memory settings object."""
    try:
        from app.models.system import SystemSetting
        from sqlalchemy import select
        
        result = await db.execute(select(SystemSetting))
        db_settings = result.scalars().all()
        
        excluded_keys = {
            "POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD",
            "DATABASE_SSL", "DATABASE_URL", "REDIS_HOST", "REDIS_PORT", "REDIS_PASSWORD",
            "REDIS_SSL", "REDIS_URL", "CELERY_BROKER_URL", "CELERY_RESULT_BACKEND",
            "APP_SECRET_KEY", "JWT_SECRET_KEY"
        }
        
        for s in db_settings:
            key = s.key.upper()
            if key in excluded_keys:
                continue
                
            if hasattr(settings, key):
                val = s.value
                val_json = s.value_json
                
                if s.value_type == "integer" and val is not None:
                    try:
                        setattr(settings, key, int(val))
                    except ValueError:
                        pass
                elif s.value_type == "float" and val is not None:
                    try:
                        setattr(settings, key, float(val))
                    except ValueError:
                        pass
                elif s.value_type == "boolean" and val is not None:
                    setattr(settings, key, val.lower() in ("true", "1", "yes"))
                elif s.value_type == "json" and val_json is not None:
                    setattr(settings, key, val_json)
                elif val is not None:
                    setattr(settings, key, val)
                    
        # Dynamically update redirect URIs if APP_URL changed
        if hasattr(settings, "APP_URL"):
            settings.GOOGLE_REDIRECT_URI = f"{settings.APP_URL}/api/v1/auth/google/callback"
            settings.FACEBOOK_REDIRECT_URI = f"{settings.APP_URL}/api/v1/auth/facebook/callback"
            
    except Exception:
        pass

