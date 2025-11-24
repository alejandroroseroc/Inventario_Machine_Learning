from __future__ import annotations
from datetime import date, timedelta
from typing import Dict
import requests

PASTO_LAT = 1.2136
PASTO_LON = -77.2811
TZ = "America/Bogota"

def _default_weather_data(start: date, end: date) -> Dict[str, dict]:
    """Datos climáticos por defecto para fechas pasadas - valores realistas para Pasto"""
    default_data = {}
    current = start
    while current <= end:
        default_data[current.isoformat()] = {
            "temp_mean": 18.0,  # Temperatura promedio en Pasto
            "precip_sum": 2.5   # Lluvia promedio en Pasto
        }
        current += timedelta(days=1)
    return default_data

def fetch_weather_daily(start: date, end: date) -> Dict[str, dict]:
    """
    Devuelve: { 'YYYY-MM-DD': {'temp_mean': float, 'precip_sum': float}, ... }
    Maneja fechas pasadas con valores por defecto.
    """
    hoy = date.today()
    
    # Si todas las fechas son pasadas, usar valores por defecto
    if end < hoy:
        return _default_weather_data(start, end)
    
    # Solo consultar API para fechas futuras
    start_future = max(start, hoy)
    if start_future > end:
        # No hay fechas futuras en el rango
        return _default_weather_data(start, end)
    
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": PASTO_LAT,
        "longitude": PASTO_LON,
        "daily": "temperature_2m_mean,precipitation_sum",
        "timezone": TZ,
        "start_date": start_future.isoformat(),
        "end_date": end.isoformat(),
    }
    
    try:
        r = requests.get(url, params=params, timeout=20)
        r.raise_for_status()
        j = r.json()
        out = {}
        days = j.get("daily", {}).get("time", []) or []
        temps = j.get("daily", {}).get("temperature_2m_mean", []) or []
        precs = j.get("daily", {}).get("precipitation_sum", []) or []
        for d, t, p in zip(days, temps, precs):
            out[d] = {"temp_mean": float(t or 0.0), "precip_sum": float(p or 0.0)}
        
        # Combinar con datos por defecto para fechas pasadas si es necesario
        if start < hoy:
            past_data = _default_weather_data(start, hoy - timedelta(days=1))
            out.update(past_data)
            
        return out
    except Exception as e:
        print(f"Error obteniendo clima: {e}, usando valores por defecto")
        return _default_weather_data(start, end)