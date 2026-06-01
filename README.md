# Inventario Machine Learning

Sistema web para la gestion de inventario de drogueria con control de productos, lotes, ventas, alertas y sugerencias de reordenamiento mediante modelos predictivos.

## Descripcion

El proyecto integra tres componentes principales:

- Backend en Django REST Framework para la API, reglas de negocio, autenticacion y persistencia.
- Frontend en React + Vite para la interfaz operativa del sistema.
- Modulo de Machine Learning en Python para limpieza de datos, entrenamiento, evaluacion y prediccion de demanda.

El sistema permite registrar medicamentos, controlar lotes por fecha de vencimiento, importar archivos CSV, registrar ventas, consultar cierres diarios y generar sugerencias de compra con base en el historial de ventas.

## Estado actual del despliegue

El despliegue principal del proyecto se realiza en AWS:

- Frontend React compilado con Vite y servido desde Nginx en una instancia EC2.
- Backend Django ejecutado con Gunicorn como servicio de sistema en la misma instancia EC2.
- Base de datos PostgreSQL administrada en Amazon RDS.
- Nginx funciona como servidor web y proxy inverso:
  - `/` sirve la aplicacion React compilada.
  - `/api/` redirige las peticiones al backend Django.
  - `/admin/` redirige al panel administrativo de Django.
  - `/static/` sirve los archivos estaticos recolectados por Django.

Render, Vercel y Neon pueden mantenerse como entornos alternos o de prueba, pero la arquitectura de produccion documentada es AWS EC2 + RDS.

## Estructura del proyecto

```text
Inventario_Machine_Learning/
|-- backend/
|   |-- core/              # Configuracion principal de Django
|   |-- inventory/         # Inventario, lotes, ventas, alertas y cierres
|   |-- users/             # Usuarios y autenticacion
|   |-- requirements.txt
|   |-- manage.py
|-- frontend/
|   |-- src/               # Aplicacion React organizada por features
|   |-- package.json
|   |-- vite.config.js
|-- ml/
|   |-- cleaning.py        # Limpieza normal de CSV
|   |-- cleaning_spark.py  # Limpieza alternativa con PySpark
|   |-- linear_daily.py    # Pipeline de prediccion diaria
|   |-- model_engine.py    # Motor de seleccion y evaluacion de modelos
|-- render.yaml            # Configuracion alterna para Render
|-- README.md
```

## Requisitos

- Python 3.12+
- Node.js 20+
- npm
- PostgreSQL local o remoto

Dependencias principales:

- Django 5.1
- Django REST Framework
- Simple JWT
- Pandas
- NumPy
- scikit-learn
- XGBoost
- React
- Vite

## Variables de entorno

### Backend

Crear `backend/.env` con las variables necesarias. No subir este archivo al repositorio.

```env
SECRET_KEY=clave-secreta-del-proyecto
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=nombre_base_datos
DB_USER=usuario_base_datos
DB_PASSWORD=clave_base_datos
DB_HOST=localhost
DB_PORT=5432
DB_SSLMODE=disable

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

En AWS se debe usar `DEBUG=False`, agregar la IP publica o dominio en `ALLOWED_HOSTS`, apuntar a RDS en `DB_HOST` y configurar `DB_SSLMODE=require` si la base de datos lo requiere.

### Frontend

Crear `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000/api
```

En AWS, si frontend y backend quedan detras del mismo Nginx, se puede compilar con:

```env
VITE_API_URL=http://IP_PUBLICA/api
```

Cuando exista dominio, se cambia por el dominio final.

## Ejecucion local

### Backend

En Windows PowerShell:

```powershell
cd "C:\Users\Andres Chaves\Inventario_Machine_Learning\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py check
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

API local:

```text
http://127.0.0.1:8000/api
```

### Frontend

En otra terminal:

```powershell
cd "C:\Users\Andres Chaves\Inventario_Machine_Learning\frontend"
npm install
npm run dev
```

Frontend local:

```text
http://127.0.0.1:5173
```

Importante: `npm run build` se ejecuta desde `frontend/`, no desde `backend/`.

## Pruebas y validacion

Backend:

```powershell
cd backend
python manage.py check
python manage.py test
```

Frontend:

```powershell
cd frontend
npm run test
npm run lint
npm run build
```

Antes de subir cambios se recomienda ejecutar:

```powershell
git status
python manage.py check
python manage.py test
npm run test
npm run build
```

## Importacion de CSV

El sistema permite importar datos para dos necesidades diferentes:

### Inventario y lotes

Se usa para registrar medicamentos, stock inicial, lotes, vencimientos, precios y margen. Los nombres exactos de columnas pueden variar si el limpiador CSV logra reconocerlos, pero se recomienda usar columnas claras como:

```text
codigo,nombre,lote,fecha_vencimiento,total_unidades,punto_reorden,categoria_abc,precio_costo,precio_venta,margen_ganancia
```

### Ventas historicas para prediccion

Este archivo alimenta el modelo de Machine Learning. Debe contener ventas reales ya ocurridas, no el inventario actual.

Campos obligatorios recomendados:

```text
codigo,fecha,cantidad
```

Campos opcionales:

```text
precio_venta,lote
```

Notas importantes:

- `codigo` debe coincidir con el codigo de barras o codigo interno del medicamento registrado.
- `fecha` debe representar la fecha real de venta.
- `cantidad` es el numero de unidades vendidas en esa fecha.
- Las ventas historicas se acumulan; si se importa dos veces el mismo archivo, las ventas pueden duplicarse.
- Para demostraciones limpias es mejor crear una cuenta nueva antes de importar CSV de prueba.
- Para evitar distorsiones en el modelo, se recomienda entrenar con ventas cerradas hasta el dia anterior.

## Machine Learning

El modulo de prediccion se encuentra en `ml/` y trabaja con series de ventas diarias por medicamento.

Flujo general:

1. Limpieza del CSV y normalizacion de columnas.
2. Construccion de una serie temporal diaria.
3. Relleno de dias sin ventas con valor 0.
4. Generacion de variables temporales y de demanda.
5. Entrenamiento de modelos candidatos.
6. Evaluacion con datos recientes.
7. Seleccion automatica del modelo con menor error.
8. Prediccion de demanda para un horizonte de 14 dias.
9. Generacion de sugerencias de reordenamiento.

Modelos usados:

- Regresion Lineal.
- XGBoost, cuando esta disponible y mejora el error de validacion.

Metricas de evaluacion:

- MAE: error absoluto medio.
- RMSE: raiz del error cuadratico medio.
- R2: capacidad explicativa del modelo.
- WAPE: error porcentual ponderado.

El sistema clasifica visualmente la confianza de la prediccion como alta, moderada o baja para apoyar la decision del usuario.

## Seguridad

- Autenticacion basada en JWT.
- Tokens de acceso y refresco mediante Simple JWT.
- Endpoints protegidos con permisos de Django REST Framework.
- CORS limitado por `CORS_ALLOWED_ORIGINS`.
- Variables sensibles en `.env`, fuera del repositorio.
- Base de datos RDS restringida por grupos de seguridad para evitar acceso publico directo.

## Despliegue en AWS

Arquitectura usada:

- EC2: Ubuntu, Nginx, Gunicorn, Django y frontend compilado.
- RDS PostgreSQL: base de datos administrada.
- Nginx: servidor web para React y proxy inverso hacia Django.
- Gunicorn: servidor WSGI para ejecutar Django.

Rutas principales:

```text
http://IP_PUBLICA/login
http://IP_PUBLICA/panel
http://IP_PUBLICA/productos
http://IP_PUBLICA/ventas
http://IP_PUBLICA/alertas
http://IP_PUBLICA/api/
http://IP_PUBLICA/admin/
```

Comandos utiles en EC2:

```bash
cd /var/www/inventario/backend
source .venv/bin/activate
python manage.py check
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart inventario-backend
sudo systemctl status inventario-backend
```

```bash
cd /var/www/inventario/frontend
npm install
npm run build
sudo systemctl restart nginx
```

Verificacion rapida:

```bash
curl -I http://IP_PUBLICA/
curl -I http://IP_PUBLICA/api/
sudo nginx -t
sudo systemctl status nginx
```

## Buenas practicas

- No subir `.env`, `.venv`, `node_modules`, `dist`, archivos temporales ni CSV generados para pruebas.
- Usar ramas para cambios de interfaz o correcciones.
- Ejecutar pruebas antes de hacer commit.
- Revisar migraciones antes de desplegar.
- Rotar credenciales si fueron compartidas por accidente.
- Mantener separados los datos reales, datos de prueba y datos de demostracion.

## Estado del proyecto

Proyecto funcional para ejecucion local, pruebas academicas y despliegue en AWS. La version actual integra inventario, lotes, ventas, cierres, alertas, importacion de CSV, autenticacion JWT y prediccion de demanda con seleccion automatica de modelo.
