from __future__ import annotations
from datetime import date, timedelta, datetime
from typing import Dict, List, Tuple
import csv, os, requests

# API Socrata de datos abiertos (ajusta el dataset si cambia).
SOCRATA_BASE = "https://www.datos.gov.co/resource/dtct-ww7w.json"

def _socrat_weekly_narino(start: date, end: date) -> List[Tuple[date, float]]:
    params = {
        "$select": "semana, departamento, sum(valor) as casos",
        "$where": "upper(departamento) like 'NAR%'",
        "$group": "semana, departamento",
        "$order": "semana",
        "$limit": 50000,
    }
    try:
        r = requests.get(SOCRATA_BASE, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        out = []
        for row in data:
            sem_raw = str(row.get("semana"))
            casos = float(row.get("casos", 0))
            try:
                year, w = sem_raw.split("-")  # ej: 2025-13
                week_start = datetime.strptime(f"{year}-W{int(w)}-1", "%G-W%V-%u").date()
            except Exception:
                continue
            if start <= week_start <= end:
                out.append((week_start, casos))
        return out
    except Exception:
        return []

def _csv_weekly_fallback(csv_path: str) -> List[Tuple[date, float]]:
    if not os.path.exists(csv_path):
        return []
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ws = date.fromisoformat(row["week_start"])
            v = float(row["cases"])
            rows.append((ws, v))
    return rows

def fetch_health_daily(start: date, end: date, csv_fallback: str = "ml/data/health_ni.csv") -> Dict[str, dict]:
    """
    Devuelve: { 'YYYY-MM-DD': {'health_idx': float}, ... } normalizado [0,1]
    """
    wk = _socrat_weekly_narino(start, end)
    if not wk:
        wk = _csv_weekly_fallback(csv_fallback)

    vals = [v for _, v in wk] or [0.0]
    vmin, vmax = min(vals), max(vals)
    norm = (lambda x: 0.0) if vmax == vmin else (lambda x: (x - vmin) / (vmax - vmin))

    daily: Dict[str, dict] = {}
    for ws, v in wk:
        for i in range(7):
            d = ws + timedelta(days=i)
            if start <= d <= end:
                daily[d.isoformat()] = {"health_idx": float(norm(v))}
    cur, last = start, 0.0
    while cur <= end:
        k = cur.isoformat()
        if k not in daily:
            daily[k] = {"health_idx": last}
        else:
            last = daily[k]["health_idx"]
        cur += timedelta(days=1)
    return daily
