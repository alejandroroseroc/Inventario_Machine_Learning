from __future__ import annotations

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score

try:
    from xgboost import XGBRegressor

    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False


def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    if len(y_true) == 0:
        return 0.0
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def _wape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    if len(y_true) == 0:
        return 0.0
    denom = float(np.sum(np.abs(y_true)))
    if denom <= 0:
        return 0.0
    return float(np.sum(np.abs(y_true - y_pred)) / denom)


def _clip_nonnegative(y_pred: np.ndarray) -> np.ndarray:
    return np.maximum(y_pred, 0)


def build_model(modelo: str):
    if modelo == "linear":
        return LinearRegression()

    if modelo == "xgboost":
        if not HAS_XGBOOST:
            raise RuntimeError("XGBoost no esta disponible en este entorno.")
        return XGBRegressor(
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

    raise ValueError(f"Modelo no soportado: {modelo}")


def train_and_select(
    X_train: np.ndarray,
    Y_train: np.ndarray,
    X_val: np.ndarray,
    Y_val: np.ndarray,
) -> dict:
    """
    Entrena LinearRegression y XGBoost sobre los mismos datos.
    Evalua ambos en validacion y selecciona el de menor RMSE.

    Returns:
        dict con keys: modelo, r2, mae, rmse, wape
    """
    lr = build_model("linear").fit(X_train, Y_train)
    lr_pred = _clip_nonnegative(lr.predict(X_val))
    lr_rmse = _rmse(Y_val, lr_pred)

    candidates = [
        {
            "modelo": "linear",
            "rmse": lr_rmse,
            "pred_val": lr_pred,
        }
    ]

    if HAS_XGBOOST and len(Y_train) >= 15:
        xgb = build_model("xgboost")
        xgb.fit(X_train, Y_train)
        xgb_pred = _clip_nonnegative(xgb.predict(X_val))
        xgb_rmse = _rmse(Y_val, xgb_pred)
        candidates.append(
            {
                "modelo": "xgboost",
                "rmse": xgb_rmse,
                "pred_val": xgb_pred,
            }
        )

    best = min(candidates, key=lambda c: c["rmse"])
    pred_val = best["pred_val"]

    if np.var(Y_val) > 0.001:
        r2 = float(r2_score(Y_val, pred_val))
    else:
        r2 = 1.0 if _rmse(Y_val, pred_val) < 0.5 else 0.0

    mae = float(mean_absolute_error(Y_val, pred_val))
    rmse = float(best["rmse"])
    wape = _wape(Y_val, pred_val)

    return {
        "modelo": best["modelo"],
        "r2": r2,
        "mae": mae,
        "rmse": rmse,
        "wape": wape,
    }
