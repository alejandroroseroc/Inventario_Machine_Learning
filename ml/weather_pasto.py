from __future__ import annotations
from datetime import date
from typing import Dict
import requests

PASTO_LAT = 1.2136
PASTO_LON = -77.2811
TZ = "America/Bogota"

def fetch_weather_daily(start: date, end: date) -> Dict[str, dict]:
    """
    Devuelve: { 'YYYY-MM-DD': {'temp_mean': float, 'precip_sum': float}, ... }
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": PASTO_LAT,
        "longitude": PASTO_LON,
        "daily": "temperature_2m_mean,precipitation_sum",
        "timezone": TZ,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
    }
    r = requests.get(url, params=params, timeout=20)
    r.raise_for_status()
    j = r.json()
    out = {}
    days = j.get("daily", {}).get("time", []) or []
    temps = j.get("daily", {}).get("temperature_2m_mean", []) or []
    precs = j.get("daily", {}).get("precipitation_sum", []) or []
    for d, t, p in zip(days, temps, precs):
        out[d] = {"temp_mean": float(t or 0.0), "precip_sum": float(p or 0.0)}
    return out
