# ml/model_engine.py
# Motor de selección automática: LinearRegression vs XGBoost.
# Selecciona el modelo con RMSE más bajo y devuelve métricas completas.

from __future__ import annotations

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_absolute_error

try:
    from xgboost import XGBRegressor
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False


def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    if len(y_true) == 0:
        return 0.0
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def train_and_select(
    X_train: np.ndarray,
    Y_train: np.ndarray,
    X_val: np.ndarray,
    Y_val: np.ndarray,
) -> dict:
    """
    Entrena LinearRegression y XGBoost sobre los mismos datos.
    Evalúa ambos en el conjunto de validación y selecciona el de menor RMSE.

    Returns:
        dict con keys: model, modelo (str), r2, mae, rmse, coef_ (optional)
    """
    # ── 1. Linear Regression ─────────────────────────────────────────────
    lr = LinearRegression().fit(X_train, Y_train)
    lr_pred = lr.predict(X_val)
    lr_rmse = _rmse(Y_val, lr_pred)

    candidates = [
        {
            "model": lr,
            "modelo": "linear",
            "rmse": lr_rmse,
            "pred_val": lr_pred,
        }
    ]

    # ── 2. XGBoost (si disponible) ───────────────────────────────────────
    if HAS_XGBOOST and len(Y_train) >= 15:
        xgb = XGBRegressor(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            verbosity=0,
        )
        xgb.fit(X_train, Y_train)
        xgb_pred = xgb.predict(X_val)
        xgb_rmse = _rmse(Y_val, xgb_pred)

        candidates.append({
            "model": xgb,
            "modelo": "xgboost",
            "rmse": xgb_rmse,
            "pred_val": xgb_pred,
        })

    # ── 3. Seleccionar mejor ─────────────────────────────────────────────
    best = min(candidates, key=lambda c: c["rmse"])

    pred_val = best["pred_val"]
    r2 = float(r2_score(Y_val, pred_val)) if len(Y_val) > 1 else 0.0
    mae = float(mean_absolute_error(Y_val, pred_val))
    rmse = best["rmse"]

    return {
        "model": best["model"],
        "modelo": best["modelo"],
        "r2": r2,
        "mae": mae,
        "rmse": rmse,
    }
