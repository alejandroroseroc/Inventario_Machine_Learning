import os
import sys
from pathlib import Path
from datetime import timedelta

from dotenv import load_dotenv

# ─── Cargar .env (solo tiene efecto en local; en Render las env vars ya existen)
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# ─── Repo root (para que ml/ sea importable)
REPO_ROOT = BASE_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# ─── Seguridad
SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    "django-insecure-y(jl-f8_=2lv@g6_v&0e!40byq$_7(_mliga*t^f2d32ae7^+j",
)
DEBUG = os.environ.get("DEBUG", "False") == "True"

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]

# ─── Apps
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Terceros
    'rest_framework',
    'corsheaders',
    # Apps del proyecto
    'users',
    'inventory',
]

# ─── Middleware
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# ─── Base de datos
# Prioridad: DB_* → fallback POSTGRES_* → valor por defecto local
_db_sslmode = os.environ.get("DB_SSLMODE", "")

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", os.environ.get("POSTGRES_DB", "inventario_db")),
        "USER": os.environ.get("DB_USER", os.environ.get("POSTGRES_USER", "postgres")),
        "PASSWORD": os.environ.get("DB_PASSWORD", os.environ.get("POSTGRES_PASSWORD", "2018")),
        "HOST": os.environ.get("DB_HOST", os.environ.get("POSTGRES_HOST", "localhost")),
        "PORT": os.environ.get("DB_PORT", os.environ.get("POSTGRES_PORT", "5432")),
        "OPTIONS": (
            {"sslmode": _db_sslmode} if _db_sslmode else {}
        ),
    }
}

# ─── Validadores de password
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── Internacionalización
LANGUAGE_CODE = 'es'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True

# ─── Estáticos
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── DRF + JWT
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# ─── CORS
CORS_ALLOW_HEADERS = [
    "accept", "accept-encoding", "authorization", "content-type", "origin",
    "user-agent", "dnt", "cache-control", "x-requested-with"
]

_cors_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
] + [o.strip() for o in _cors_origins.split(",") if o.strip()]
