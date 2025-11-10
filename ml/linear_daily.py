# ml/linear_daily.py
from __future__ import annotations
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional
import numpy as np
from sklearn.linear_model import LinearRegression

from django.db.models import Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from inventory.models import Movimiento
from .calendar_co import is_carnaval
from .weather_pasto import fetch_weather_daily
from .health_ni import fetch_health_daily


@dataclass
class ForecastResult:
    yhat_total: float
    rmse: float
    safety: int
    serie: list          # lista de {"date": ISO, "yhat": float}
    top_factors: list    # lista de {"factor": str, "impacto": float}

    # Back-compat: res.top sigue funcionando pero sin gatillar el linter de CSS
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


def _merge_external(rows: list) -> list:
    if not rows:
        return rows
    start, end = rows[0]["date"], rows[-1]["date"]

    weather = fetch_weather_daily(start, end)   # {'YYYY-MM-DD': {'temp_mean', 'precip_sum'}}
    health  = fetch_health_daily(start, end)    # {'YYYY-MM-DD': {'health_idx'}}

    out = []
    for r in rows:
        k = r["date"].isoformat()
        w = weather.get(k, {"temp_mean": 0.0, "precip_sum": 0.0})
        h = health.get(k, {"health_idx": 0.0})
        r2 = dict(r)
        r2.update(w)
        r2.update(h)
        out.append(r2)
    return out


def _build_matrix(rows: list):
    """
    Features:
      y_lag1, y_lag7, MA7, dummies DOW(1..6) [0 baseline], carnaval, temp_mean, precip_sum, health_idx
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
        dow = d.weekday()  # 0..6
        dummies = [1 if dow == k else 0 for k in range(1, 7)]  # 6 dummies, 0 es baseline

        temp_mean = float(rows[i].get("temp_mean", 0.0))
        precip_sum = float(rows[i].get("precip_sum", 0.0))
        health_idx = float(rows[i].get("health_idx", 0.0))

        x = [y_lag1, y_lag7, ma7] + dummies + [int(is_carnaval(d)), temp_mean, precip_sum, health_idx]
        X.append(x)
        Y.append(y)
        dates.append(d)

    feature_names = (
        ["lag1", "lag7", "ma7"] +
        [f"dow_{k}" for k in range(1, 7)] +
        ["carnaval", "temp_mean", "precip_sum", "health_idx"]
    )
    return np.array(X, dtype=float), np.array(Y, dtype=float), dates, feature_names


def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    if len(y_true) == 0:
        return 0.0
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def _predict_iterative(model: LinearRegression, hist_rows: list, feature_names: list, h: int):
    """
    Predice día a día para horizonte h, recalculando lag/MA7 con predicciones.
    Devuelve serie y contribuciones acumuladas por feature.
    """
    serie = []
    contrib_sum = np.zeros(len(feature_names), dtype=float)

    for _ in range(h):
        i = len(hist_rows)
        d = hist_rows[-1]["date"] + timedelta(days=1)

        if i < 7:
            x = [hist_rows[-1]["y"], 0, hist_rows[-1]["y"]] + [0] * 6 + [0, 0.0, 0.0, 0.0]
        else:
            y_lag1 = hist_rows[-1]["y"]
            y_lag7 = hist_rows[-7]["y"]
            ma7 = sum(r["y"] for r in hist_rows[-7:]) / 7.0
            dow = d.weekday()
            dummies = [1 if dow == k else 0 for k in range(1, 7)]
            # futuro: uso último valor observado de exógenas (simple)
            last = hist_rows[-1]
            temp_mean = float(last.get("temp_mean", 0.0))
            precip_sum = float(last.get("precip_sum", 0.0))
            health_idx = float(last.get("health_idx", 0.0))
            x = [y_lag1, y_lag7, ma7] + dummies + [int(is_carnaval(d)), temp_mean, precip_sum, health_idx]

        yhat = float(model.predict([x])[0])

        if hasattr(model, "coef_"):
            contrib_sum += (model.coef_ * np.array(x, dtype=float))

        serie.append({"date": d.isoformat(), "yhat": max(0.0, yhat)})

        hist_rows.append({
            "date": d,
            "y": max(0.0, yhat),
            "temp_mean": x[-3],
            "precip_sum": x[-2],
            "health_idx": x[-1],
        })

    return serie, contrib_sum


def forecast_daily(producto_id: int, h: int = 14, lookback_days: int = 180, abc: Optional[str] = None) -> ForecastResult:
    rows = _merge_external(_daily_series(producto_id, lookback_days))
    X, Y, dates, feature_names = _build_matrix(rows)

    if len(Y) < 30:
        return ForecastResult(yhat_total=0, rmse=0, safety=0, serie=[], top_factors=[])

    model = LinearRegression().fit(X, Y)

    val_k = min(28, len(Y))
    y_pred = model.predict(X[-val_k:])
    rmse = _rmse(Y[-val_k:], y_pred)

    cat = (abc or "C")
    z = 1.64 if cat == "A" else (1.28 if cat == "B" else 0.84)
    safety = int(np.ceil(z * rmse))

    hist_copy = rows.copy()
    serie, contrib_sum = _predict_iterative(model, hist_copy, feature_names, h)
    yhat_total = float(sum(s["yhat"] for s in serie))

    top_pairs = sorted(
        [{"factor": fn, "impacto": float(v)} for fn, v in zip(feature_names, contrib_sum)],
        key=lambda x: x["impacto"],
        reverse=True,
    )
    top = [p for p in top_pairs if p["impacto"] > 0][:3]

    return ForecastResult(
        yhat_total=yhat_total,
        rmse=rmse,
        safety=safety,
        serie=serie,
        top_factors=top,
    )
