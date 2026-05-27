# Inventario Machine Learning

Sistema web para gestion de inventario con prediccion de demanda, alertas de stock y control de ventas/lotes.

## Descripcion

Este proyecto integra:

- **Backend** en Django + Django REST Framework para exponer la API.
- **Frontend** en React + Vite para la interfaz web.
- **Modulo ML** en Python para calculos de prediccion y soporte de decisiones.

El objetivo es apoyar la gestion de inventario con funcionalidades operativas (productos, lotes, movimientos, ventas) y analiticas (forecast diario y sugerencias).

## Estructura del proyecto

```text
Inventario_Machine_Learning/
├── backend/        # API Django, logica de negocio, modelos y migraciones
├── frontend/       # Aplicacion React (Vite)
├── ml/             # Modelos y utilidades de machine learning
├── render.yaml     # Configuracion de despliegue del backend en Render
└── README.md
```

## Requisitos

- Python 3.13+
- Node.js 18+ (recomendado 20+)
- npm 9+
- PostgreSQL (local o remoto)

## Configuracion de entorno

### 1) Backend (`backend/.env`)

Puedes partir de `backend/.env.example`.

Variables principales:

- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `DB_SSLMODE` (si usas proveedor remoto con SSL)
- `CORS_ALLOWED_ORIGINS` (URL del frontend)

### 2) Frontend (`frontend/.env`)

Puedes partir de `frontend/.env.example`.

- `VITE_API_URL=http://localhost:8000/api` (desarrollo local)

En produccion debes apuntar a la URL publica del backend, por ejemplo:

- `VITE_API_URL=https://tu-backend.onrender.com/api`

## Instalacion y ejecucion local

## Backend (Django)

Desde la raiz del proyecto:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

API local disponible en:

- `http://127.0.0.1:8000/api`

## Frontend (React + Vite)

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend local disponible en:

- `http://127.0.0.1:5173`

## Comandos utiles

### Backend

```bash
cd backend
source .venv/bin/activate
python manage.py check
python manage.py migrate
python manage.py createsuperuser
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run test
```

## Despliegue

## Backend en Render

El archivo `render.yaml` ya define:

- servicio web Python
- `rootDir: backend`
- `buildCommand: ./build.sh`
- `startCommand: gunicorn core.wsgi:application`

`build.sh` ejecuta:

1. instalacion de dependencias
2. `collectstatic`
3. `migrate`

Antes de publicar, configura en Render las variables de entorno de base de datos y seguridad.

## Frontend en Vercel

El archivo `frontend/vercel.json` contiene rewrite para SPA.

Importante:

- Configura `VITE_API_URL` en Vercel para apuntar al backend desplegado.

## Modulos principales (resumen)

- **Autenticacion**: login, registro y perfil (`/api/auth/*`)
- **Inventario**:
  - productos
  - lotes
  - movimientos
  - alertas de stock
- **Ventas**: registro, detalle, cierre diario e historial
- **ML**:
  - forecast por producto
  - forecast diario
  - sugerencia de punto de reorden

## Buenas practicas recomendadas

- No subir archivos `.env` al repositorio.
- Definir `DEBUG=False` en produccion.
- Limitar `CORS_ALLOWED_ORIGINS` a dominios reales del frontend.
- Mantener migraciones al dia y versionadas.

## Estado del proyecto

Proyecto funcional con arquitectura separada por capas (API, UI y ML), listo para ejecucion local y desplegable en Render + Vercel con configuracion de entorno adecuada.