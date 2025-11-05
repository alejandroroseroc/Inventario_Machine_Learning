# /ml/baseline.py
# Baseline simple de regresión lineal para predecir el siguiente punto de una serie.
# No depende de pandas/sklearn. Funciona con listas de ints/floats.

from typing import List

def predict_next_month_from_series(y: List[float]) -> int:
    """
    Recibe y = [y0, y1, ..., y_{n-1}] (ventas mensuales, por ejemplo).
    Devuelve y_n predicho usando OLS con x = 0..n-1.
    Si n < 2, usa promedio/último valor como fallback.
    El resultado se trunca a entero >= 0.
    """
    n = len(y)
    if n == 0:
        return 0
    if n == 1:
        return max(0, int(round(y[0])))

    x = list(range(n))
    mean_x = sum(x) / n
    mean_y = sum(y) / n

    sxx = sum((xi - mean_x) ** 2 for xi in x)
    if sxx == 0:
        return max(0, int(round(y[-1])))

    sxy = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
    b1 = sxy / sxx
    b0 = mean_y - b1 * mean_x
    y_next = b0 + b1 * n

    return max(0, int(round(y_next)))
