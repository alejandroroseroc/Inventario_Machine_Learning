from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Optional

import numpy as np
from django.db.models import Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from inventory.models import Movimiento
from ml.model_engine import build_model, train_and_select


FEATURE_NAMES = [
    "lag1",
    "lag7",
    "ma7",
    "es_quincena",
    "es_finde",
    "tendencia",
] + [f"dow_{k}" for k in range(1, 7)]


@dataclass
class ForecastResult:
    yhat_total: float
    rmse: float
    r2: float = 0.0
    mae: float = 0.0
    wape: float = 0.0
    modelo: str = "linear"
    safety: int = 0
    serie: list = field(default_factory=list)
    historico: list = field(default_factory=list)
    top_factors: list = field(default_factory=list)

    @property
    def top(self) -> list:
        return self.top_factors


def daily_series(producto_id: int, lookback_days: int = 180) -> list:
    hoy = timezone.localdate()
    ini = hoy - timedelta(days=lookback_days)

    qs = (
        Movimiento.objects.filter(
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

    rows = []
    d = ini
    ayer = hoy - timedelta(days=1)
    while d <= ayer:
        rows.append({"date": d, "y": by_date.get(d, 0)})
        d += timedelta(days=1)
    return rows


def build_matrix(rows: list):
    import pandas as pd

    if not rows:
        return np.array([]), np.array([]), [], FEATURE_NAMES

    all_y = [float(r["y"]) for r in rows]
    all_dates = [r["date"] for r in rows]

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

        es_quin = 1.0 if dia_mes[i] in [14, 15, 16, 29, 30, 31] else 0.0
        es_finde = 1.0 if dias_semana[i] in [4, 5] else 0.0
        tend = float(dias_desde_inicio[i])

        dow = dias_semana[i]
        dummies = [1.0 if dow == k else 0.0 for k in range(1, 7)]

        x = [y_lag1, y_lag7, ma7, es_quin, es_finde, tend] + dummies
        X.append(x)
        Y.append(y)
        dates.append(all_dates[i])

    return np.array(X, dtype=float), np.array(Y, dtype=float), dates, FEATURE_NAMES


def _predict_iterative(model, hist_rows: list, feature_names: list, h: int, start_idx: int = 0):
    serie = []
    contrib_sum = np.zeros(len(feature_names), dtype=float)

    for _ in range(h):
        i = len(hist_rows)
        d = hist_rows[-1]["date"] + timedelta(days=1)

        y_lag1 = float(hist_rows[-1]["y"])
        y_lag7 = float(hist_rows[-7]["y"]) if i >= 7 else y_lag1
        ma7 = sum(float(r["y"]) for r in hist_rows[-7:]) / 7.0 if i >= 7 else y_lag1

        es_quin = 1.0 if d.day in [14, 15, 16, 29, 30, 31] else 0.0
        es_finde = 1.0 if d.weekday() in [4, 5] else 0.0
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
        hist_rows.append({"date": d, "y": yhat_clipped})

    return serie, contrib_sum


def forecast_daily(
    producto_id: int,
    h: int = 14,
    lookback_days: int = 180,
    abc: Optional[str] = None,
) -> ForecastResult:
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
                wape=1.0,
                modelo="insuficiente",
                safety=0,
                serie=[],
                historico=historico,
                top_factors=[{"factor": "insuficientes_datos", "impacto": 0}],
            )

        # Detectar actividad insuficiente: si menos del 5% de los días tuvo ventas
        dias_con_ventas = int(np.sum(Y > 0))
        ratio_actividad = dias_con_ventas / len(Y) if len(Y) > 0 else 0

        if ratio_actividad < 0.05:
            historico = [{"date": r["date"].isoformat(), "y_real": r["y"]} for r in rows[-30:]]
            promedio_bajo = float(np.mean(Y))
            return ForecastResult(
                yhat_total=round(promedio_bajo * h, 2),
                rmse=0,
                r2=0,
                mae=0,
                wape=0.8,
                modelo="actividad_insuficiente",
                safety=0,
                serie=[],
                historico=historico,
                top_factors=[{"factor": "sin_demanda_reciente", "impacto": 0}],
            )

        if np.var(Y) == 0:
            historico = [{"date": r["date"].isoformat(), "y_real": r["y"]} for r in rows[-30:]]
            promedio = float(np.mean(Y))
            return ForecastResult(
                yhat_total=promedio * h,
                rmse=0,
                r2=1.0 if promedio > 0 else 0.0,
                mae=0,
                wape=0.0 if promedio > 0 else 0.5,
                modelo="constante",
                safety=0,
                serie=[
                    {"date": (dates[-1] + timedelta(days=i + 1)).isoformat(), "yhat": promedio}
                    for i in range(h)
                ],
                historico=historico,
                top_factors=[{"factor": "ventas_constantes", "impacto": 1.0}],
            )

        val_k = min(21, len(Y) // 4)
        X_train, Y_train = X[:-val_k], Y[:-val_k]
        X_val, Y_val = X[-val_k:], Y[-val_k:]

        if len(Y_train) < 10:
            X_train, Y_train = X, Y
            X_val, Y_val = X[-val_k:], Y[-val_k:]

        result = train_and_select(X_train, Y_train, X_val, Y_val)
        modelo_nombre = result["modelo"]
        r2 = result["r2"]
        mae = result["mae"]
        rmse = result["rmse"]
        wape = result["wape"]

        cat = abc or "C"
        z = 1.64 if cat == "A" else (1.28 if cat == "B" else 0.84)
        safety = int(np.ceil(z * rmse))

        model = build_model(modelo_nombre)
        model.fit(X, Y)

        hist_copy = rows.copy()
        serie, contrib_sum = _predict_iterative(model, hist_copy, feature_names, h)
        yhat_total = float(sum(s["yhat"] for s in serie))

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

        historico = [{"date": r["date"].isoformat(), "y_real": r["y"]} for r in rows[-30:]]

        return ForecastResult(
            yhat_total=yhat_total,
            rmse=rmse,
            r2=r2,
            mae=mae,
            wape=wape,
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
            wape=0,
            modelo="error",
            safety=0,
            serie=[],
            historico=[],
            top_factors=[{"factor": "error", "impacto": 0}],
        )
