# ml/linear_daily.py
# Modelo de pronóstico diario de demanda para droguería.
# Features: lags de ventas, MA7, día de semana.
# Basado únicamente en las ventas históricas de la droguería.
# Auto-selecciona entre LinearRegression y XGBoost (menor RMSE).

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import timedelta, date
from typing import Optional, List
import numpy as np
from sklearn.linear_model import LinearRegression

from django.db.models import Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from inventory.models import Movimiento
from ml.model_engine import train_and_select

# ── Whitelist de features permitidos ─────────────────────────────────────
FEATURE_NAMES = ["lag1", "lag7", "ma7", "es_quincena", "es_finde", "tendencia"] + [f"dow_{k}" for k in range(1, 7)]


@dataclass
class ForecastResult:
    yhat_total: float
    rmse: float
    r2: float = 0.0           # Coeficiente de determinación
    mae: float = 0.0          # Error absoluto medio
    modelo: str = "linear"    # "linear" o "xgboost"
    safety: int = 0
    serie: list = field(default_factory=list)        # [{date: ISO, yhat: float}]
    historico: list = field(default_factory=list)     # [{date: ISO, y_real: int}]
    top_factors: list = field(default_factory=list)   # [{factor: str, impacto: float}]

    @property
    def top(self) -> list:
        return self.top_factors


def daily_series(producto_id: int, lookback_days: int = 180) -> list:
    """[{date, y}] ventas diarias (0 si no hubo venta) en ventana de entrenamiento."""
    hoy = timezone.localdate()
    ini = hoy - timedelta(days=lookback_days)

    qs = (
        Movimiento.objects
        .filter(
            producto_id=producto_id,
            tipo="salida",
            fecha_mov__date__gte=ini,
            fecha_mov__date__lt=hoy,
        )
        .exclude(venta__anulada=True)
        .annotate(d=TruncDate("fecha_mov"))
        .values("d")
        .annotate(total=Sum("cantidad"))
    )
    by_date = {row["d"]: int(row["total"] or 0) for row in qs}

    rows, d = [], ini
    ayer = hoy - timedelta(days=1)
    while d <= ayer:
        rows.append({"date": d, "y": by_date.get(d, 0)})
        d += timedelta(days=1)
    return rows


def build_matrix(rows: list):
    """
    Construye la matriz de features para el modelo.
    Incluye features expertos (quincena, finde, tendencia).
    """
    import pandas as pd
    if not rows:
        return np.array([]), np.array([]), [], FEATURE_NAMES
        
    all_y = [float(r["y"]) for r in rows]
    all_dates = [r["date"] for r in rows]
    
    # Pre-calculos para performance y facilidad
    fechas_pd = pd.to_datetime(all_dates)
    dia_mes = fechas_pd.day
    dias_semana = fechas_pd.weekday
    dias_desde_inicio = (fechas_pd - fechas_pd[0]).days

    X, Y, dates = [], [], []
    for i in range(len(rows)):
        if i < 7:
            continue

        y = all_y[i]
        y_lag1 = all_y[i - 1]
        y_lag7 = all_y[i - 7]
        ma7 = sum(all_y[j] for j in range(i - 7, i)) / 7.0
        
        # Expert features
        es_quin = 1.0 if dia_mes[i] in [14, 15, 16, 29, 30, 31] else 0.0
        es_finde = 1.0 if dias_semana[i] in [4, 5] else 0.0
        tend = float(dias_desde_inicio[i])
        
        dow = dias_semana[i]                                        # 0..6
        dummies = [1.0 if dow == k else 0.0 for k in range(1, 7)]   # 6 dummies

        x = [y_lag1, y_lag7, ma7, es_quin, es_finde, tend] + dummies
        X.append(x)
        Y.append(y)
        dates.append(all_dates[i])

    return np.array(X, dtype=float), np.array(Y, dtype=float), dates, FEATURE_NAMES


def _predict_iterative(model, hist_rows: list, feature_names: list, h: int, start_idx: int = 0):
    """
    Predice día a día para horizonte h.
    """
    serie = []
    contrib_sum = np.zeros(len(feature_names), dtype=float)

    for step in range(h):
        i = len(hist_rows)
        d = hist_rows[-1]["date"] + timedelta(days=1)

        y_lag1 = float(hist_rows[-1]["y"])
        y_lag7 = float(hist_rows[-7]["y"]) if i >= 7 else y_lag1
        ma7 = sum(float(r["y"]) for r in hist_rows[-7:]) / 7.0 if i >= 7 else y_lag1
        
        # Expert features
        es_quin = 1.0 if d.day in [14, 15, 16, 29, 30, 31] else 0.0
        es_finde = 1.0 if d.weekday() in [4, 5] else 0.0
        # Tendencia relativa
        tend = float(start_idx + i) 
        
        dow = d.weekday()
        dummies = [1.0 if dow == k else 0.0 for k in range(1, 7)]
        x = [y_lag1, y_lag7, ma7, es_quin, es_finde, tend] + dummies

        x_arr = np.array([x], dtype=float)
        yhat = float(model.predict(x_arr)[0])

        if hasattr(model, "coef_"):
            contrib_sum += model.coef_ * np.array(x, dtype=float)

        yhat_clipped = max(0.0, yhat)
        serie.append({"date": d.isoformat(), "yhat": round(yhat_clipped, 2)})

        hist_rows.append({
            "date": d,
            "y": yhat_clipped,
        })

    return serie, contrib_sum


def forecast_daily(
    producto_id: int,
    h: int = 14,
    lookback_days: int = 180,
    abc: Optional[str] = None,
) -> ForecastResult:
    """
    Pronóstico diario de demanda para un producto.
    Usa únicamente las ventas históricas de la droguería.
    Auto-selecciona LinearRegression vs XGBoost por RMSE más bajo.

    Args:
        producto_id:   ID del producto en la BD
        h:             Horizonte de predicción en días
        lookback_days: Días históricos usados para entrenamiento
        abc:           Categoría del producto (A/B/C) — ajusta el stock de seguridad

    Returns:
        ForecastResult con yhat_total, métricas (r2, mae, rmse), safety, serie y top features.
    """
    try:
        rows = daily_series(producto_id, lookback_days)
        X, Y, dates, feature_names = build_matrix(rows)

        if len(Y) < 10 or np.sum(Y) == 0:
            historico = [{"date": r["date"].isoformat(), "y_real": r["y"]} for r in rows[-30:]]
            return ForecastResult(
                yhat_total=0,
                rmse=0,
                r2=0,
                mae=0,
                modelo="insuficiente",
                safety=0,
                serie=[],
                historico=historico,
                top_factors=[{"factor": "insuficientes_datos", "impacto": 0}]
            )
            
        # Si la varianza de Y es 0 (ej. todos los días se venden exactamente 3 unidades, o 0 unidades), R2 será matemáticamente 0.
        if np.var(Y) == 0:
            historico = [{"date": r["date"].isoformat(), "y_real": r["y"]} for r in rows[-30:]]
            return ForecastResult(
                yhat_total=float(np.mean(Y) * h),
                rmse=0,
                r2=1.0, # Técnicamente es constante, le damos 1.0 para no asustar con "baja confianza" cuando es 100% predecible o lo marcamos especial
                mae=0,
                modelo="constante",
                safety=0,
                serie=[{"date": (dates[-1] + timedelta(days=i+1)).isoformat(), "yhat": float(np.mean(Y))} for i in range(h)],
                historico=historico,
                top_factors=[{"factor": "ventas_constantes", "impacto": 1.0}]
            )

        # ── Entrenar y seleccionar mejor modelo ─────────────────────────
        val_k = min(21, len(Y) // 4) # Usar 21 días o el 25% para validar más robustamente
        X_train, Y_train = X[:-val_k], Y[:-val_k]
        X_val, Y_val = X[-val_k:], Y[-val_k:]

        # Al menos 10 puntos de entrenamiento
        if len(Y_train) < 10:
            X_train, Y_train = X, Y
            X_val, Y_val = X[-val_k:], Y[-val_k:]

        result = train_and_select(X_train, Y_train, X_val, Y_val)
        model = result["model"]
        modelo_nombre = result["modelo"]
        r2 = result["r2"]
        mae = result["mae"]
        rmse = result["rmse"]

        # Stock de seguridad ajustado por categoría ABC
        cat = abc or "C"
        z = 1.64 if cat == "A" else (1.28 if cat == "B" else 0.84)
        safety = int(np.ceil(z * rmse))

        # ── Predicción iterativa ────────────────────────────────────────
        hist_copy = rows.copy()
        serie, contrib_sum = _predict_iterative(model, hist_copy, feature_names, h)
        yhat_total = float(sum(s["yhat"] for s in serie))

        # ── Top factores ────────────────────────────────────────────────
        if hasattr(model, "coef_"):
            top_pairs = sorted(
                [{"factor": fn, "impacto": float(abs(v))} for fn, v in zip(feature_names, contrib_sum)],
                key=lambda x: x["impacto"],
                reverse=True,
            )
        elif hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
            top_pairs = sorted(
                [{"factor": fn, "impacto": float(v)} for fn, v in zip(feature_names, importances)],
                key=lambda x: x["impacto"],
                reverse=True,
            )
        else:
            top_pairs = [{"factor": "tendencia", "impacto": 0}]

        # ── Histórico para gráfica ──────────────────────────────────────
        historico = [{"date": r["date"].isoformat(), "y_real": r["y"]} for r in rows[-30:]]

        return ForecastResult(
            yhat_total=yhat_total,
            rmse=rmse,
            r2=r2,
            mae=mae,
            modelo=modelo_nombre,
            safety=safety,
            serie=serie,
            historico=historico,
            top_factors=top_pairs[:3],
        )

    except Exception as e:
        print(f"Error en forecast_daily para producto {producto_id}: {e}")
        return ForecastResult(
            yhat_total=0,
            rmse=0,
            r2=0,
            mae=0,
            modelo="error",
            safety=0,
            serie=[],
            historico=[],
            top_factors=[{"factor": "error", "impacto": 0}]
        )