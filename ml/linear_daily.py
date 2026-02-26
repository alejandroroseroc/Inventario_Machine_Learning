# ml/linear_daily.py
# Modelo de pronóstico diario de demanda para droguería.
# Features: lags de ventas, MA7, día de semana.
# Basado únicamente en las ventas históricas de la droguería.

from __future__ import annotations
from dataclasses import dataclass
from datetime import timedelta, date
from typing import Optional
import numpy as np
from sklearn.linear_model import LinearRegression

from django.db.models import Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from inventory.models import Movimiento


@dataclass
class ForecastResult:
    yhat_total: float
    rmse: float
    safety: int
    serie: list          # lista de {"date": ISO, "yhat": float}
    top_factors: list    # lista de {"factor": str, "impacto": float}

    @property
    def top(self) -> list:
        return self.top_factors


def _daily_series(producto_id: int, lookback_days: int = 180) -> list:
    """[{date, y}] ventas diarias (0 si no hubo venta) en ventana de entrenamiento."""
    hoy = timezone.localdate()
    ini = hoy - timedelta(days=lookback_days)

    qs = (
        Movimiento.objects
        .filter(
            producto_id=producto_id,
            tipo="salida",
            fecha_mov__date__gte=ini,
            fecha_mov__date__lte=hoy,
        )
        .annotate(d=TruncDate("fecha_mov"))
        .values("d")
        .annotate(total=Sum("cantidad"))
    )
    by_date = {row["d"]: int(row["total"] or 0) for row in qs}

    rows, d = [], ini
    while d <= hoy:
        rows.append({"date": d, "y": by_date.get(d, 0)})
        d += timedelta(days=1)
    return rows


def _build_matrix(rows: list):
    """
    Construye la matriz de features para el modelo lineal.

    Features (9 en total):
        lag1, lag7, MA7,
        dummies DOW (1..6) [0=Lunes es baseline]
    """
    X, Y, dates = [], [], []
    for i in range(len(rows)):
        if i < 7:
            continue

        d = rows[i]["date"]
        y = rows[i]["y"]
        y_lag1 = rows[i - 1]["y"]
        y_lag7 = rows[i - 7]["y"]
        ma7 = sum(r["y"] for r in rows[i - 7:i]) / 7.0
        dow = d.weekday()                                        # 0..6
        dummies = [1 if dow == k else 0 for k in range(1, 7)]   # 6 dummies

        x = [y_lag1, y_lag7, ma7] + dummies
        X.append(x)
        Y.append(y)
        dates.append(d)

    feature_names = (
        ["lag1", "lag7", "ma7"] +
        [f"dow_{k}" for k in range(1, 7)]
    )
    return np.array(X, dtype=float), np.array(Y, dtype=float), dates, feature_names


def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    if len(y_true) == 0:
        return 0.0
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def _predict_iterative(model: LinearRegression, hist_rows: list, feature_names: list, h: int):
    """
    Predice día a día para horizonte h, recalculando lag/MA7 con predicciones anteriores.
    Devuelve (serie, contribuciones_acumuladas_por_feature).
    """
    serie = []
    contrib_sum = np.zeros(len(feature_names), dtype=float)

    for _ in range(h):
        i = len(hist_rows)
        d = hist_rows[-1]["date"] + timedelta(days=1)

        if i < 7:
            x = [hist_rows[-1]["y"], 0, hist_rows[-1]["y"]] + [0] * 6
        else:
            y_lag1 = hist_rows[-1]["y"]
            y_lag7 = hist_rows[-7]["y"]
            ma7 = sum(r["y"] for r in hist_rows[-7:]) / 7.0
            dow = d.weekday()
            dummies = [1 if dow == k else 0 for k in range(1, 7)]
            x = [y_lag1, y_lag7, ma7] + dummies

        yhat = float(model.predict([x])[0])

        if hasattr(model, "coef_"):
            contrib_sum += model.coef_ * np.array(x, dtype=float)

        yhat_clipped = max(0.0, yhat)
        serie.append({"date": d.isoformat(), "yhat": yhat_clipped})

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

    Args:
        producto_id:   ID del producto en la BD
        h:             Horizonte de predicción en días
        lookback_days: Días históricos usados para entrenamiento
        abc:           Categoría del producto (A/B/C) — ajusta el stock de seguridad

    Returns:
        ForecastResult con yhat_total, rmse, safety, serie diaria y top features.
    """
    try:
        rows = _daily_series(producto_id, lookback_days)
        X, Y, dates, feature_names = _build_matrix(rows)

        if len(Y) < 10:
            return ForecastResult(
                yhat_total=0,
                rmse=0,
                safety=0,
                serie=[],
                top_factors=[{"factor": "insuficientes_datos", "impacto": 0}]
            )

        model = LinearRegression().fit(X, Y)

        val_k = min(14, len(Y))
        y_pred = model.predict(X[-val_k:])
        rmse = _rmse(Y[-val_k:], y_pred)

        # Stock de seguridad ajustado por categoría ABC
        cat = abc or "C"
        z = 1.64 if cat == "A" else (1.28 if cat == "B" else 0.84)
        safety = int(np.ceil(z * rmse))

        hist_copy = rows.copy()
        serie, contrib_sum = _predict_iterative(model, hist_copy, feature_names, h)
        yhat_total = float(sum(s["yhat"] for s in serie))

        top_pairs = sorted(
            [{"factor": fn, "impacto": float(abs(v))} for fn, v in zip(feature_names, contrib_sum)],
            key=lambda x: x["impacto"],
            reverse=True,
        )

        return ForecastResult(
            yhat_total=yhat_total,
            rmse=rmse,
            safety=safety,
            serie=serie,
            top_factors=top_pairs[:3],
        )

    except Exception as e:
        print(f"Error en forecast_daily para producto {producto_id}: {e}")
        return ForecastResult(
            yhat_total=0,
            rmse=0,
            safety=0,
            serie=[],
            top_factors=[{"factor": "error", "impacto": 0}]
        )