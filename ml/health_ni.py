from __future__ import annotations
from datetime import date, timedelta, datetime
from typing import Dict, List, Tuple
import csv, os, requests
import json

# API Real de IRA (Infección Respiratoria Aguda) - Colombia
IRA_API = "https://www.datos.gov.co/resource/dtct-ww7w.json"

def _fetch_ira_narino(start: date, end: date) -> List[Tuple[date, float]]:
    """
    Obtiene datos reales de IRA para Nariño/Pasto desde SIVIGILA
    IRA es el indicador clave para ventas de medicamentos para gripa
    """
    try:
        # Filtrar por Nariño y rango de años
        params = {
            "$where": f"departamento_nom='NARIÑO' AND ano >= {start.year} AND ano <= {end.year}",
            "$limit": 10000,
            "$order": "ano, semana_epidemiologica"
        }
        
        print(f"🔍 Consultando datos IRA para Nariño...")
        r = requests.get(IRA_API, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        
        # Si no hay datos con ese filtro, intentar sin WHERE
        if not data or len(data) == 0:
            print(f"⚠️ Intento 1 fallido, probando sin filtro WHERE...")
            params = {
                "$limit": 10000,
                "$order": "ano DESC, semana_epidemiologica DESC"
            }
            r = requests.get(IRA_API, params=params, timeout=30)
            data = r.json()
        
        out = []
        for row in data:
            try:
                # Filtrar manualmente por Nariño
                dept = str(row.get("departamento_nom", "")).upper()
                if "NARIÑO" not in dept and "NARINO" not in dept:
                    continue
                
                ano = int(row.get("ano", 0))
                semana = int(row.get("semana_epidemiologica", row.get("semana", 1)))
                
                # Campos clave para medicamentos de gripa/IRA:
                # - consultas_externas: personas que consultan por IRA
                # - hospitalizaciones: casos más graves
                # - muertes: indicador de gravedad del brote
                consultas = float(row.get("consultas_externas_urgencias", row.get("ira_consulta_externa_y_urgencias", 0)))
                hospitalizaciones = float(row.get("hospitalizaciones_irag", row.get("hospitalizaciones_por_irag", 0)))
                
                # Índice combinado: más peso a consultas (demanda directa de medicamentos)
                casos_totales = (consultas * 0.8) + (hospitalizaciones * 0.2)
                
                # Calcular fecha de inicio de semana epidemiológica
                if ano >= 2020 and 1 <= semana <= 53:
                    try:
                        week_start = datetime.strptime(f"{ano}-W{semana:02d}-1", "%G-W%V-%u").date()
                    except ValueError:
                        # Para semana 53 que a veces falla
                        week_start = date(ano, 12, 25)
                    
                    if start <= week_start <= end:
                        out.append((week_start, casos_totales))
                        
            except (ValueError, KeyError, TypeError) as e:
                continue
        
        if out:
            print(f"Obtenidos {len(out)} registros de IRA para Nariño")
        else:
            print(f"No se encontraron datos de IRA")
        
        return out
    
    except Exception as e:
        print(f"Error API IRA: {e}")
        return []

def _generate_pasto_seasonal_pattern(start: date, end: date) -> List[Tuple[date, float]]:
    """
    Genera patrón estacional de IRA específico para Pasto basado en datos históricos:
    - Picos en: Abril-Mayo (lluvias + cambios de temperatura) y Octubre-Diciembre (época de lluvias + frío)
    - Mayor demanda de medicamentos antigripales en estos meses
    - Considera el Carnaval de Negros y Blancos (2-7 enero) que aumenta contagios
    """
    import math
    data = []
    current = start
    
    while current <= end:
        mes = current.month
        dia = current.day
        dia_año = current.timetuple().tm_yday
        
        # Patrón base mensual para Pasto
        if mes in [12, 1, 2]:  # Diciembre-Febrero: Época de lluvias + frío + Carnaval
            base = 0.85
            # Pico extra durante el Carnaval (2-10 enero)
            if mes == 1 and 2 <= dia <= 10:
                base = 0.95  # Máximo por contagios masivos en carnaval
        elif mes in [4, 5]:  # Abril-Mayo: Primera temporada fuerte de IRA
            base = 0.75
        elif mes in [10, 11]:  # Octubre-Noviembre: Segunda temporada fuerte
            base = 0.80
        elif mes in [6, 7, 8]:  # Junio-Agosto: Temporada seca, menor incidencia
            base = 0.30
        else:  # Marzo, Septiembre: Transición
            base = 0.50
        
        # Variación sinusoidal para simular variación semanal natural
        variacion_semanal = 0.1 * math.sin(2 * math.pi * dia_año / 365)
        
        # Variación por día de la semana (más consultas inicio de semana)
        dia_semana = current.weekday()  # 0=Lunes, 6=Domingo
        if dia_semana in [0, 1]:  # Lunes y Martes: más consultas
            variacion_dia = 0.05
        elif dia_semana in [5, 6]:  # Fin de semana: menos consultas
            variacion_dia = -0.10
        else:
            variacion_dia = 0
        
        valor_final = max(0.1, min(1.0, base + variacion_semanal + variacion_dia))
        data.append((current, valor_final))
        
        current += timedelta(days=1)
    
    return data

def _aggregate_with_seasonality(ira_data: List[Tuple[date, float]], 
                                 seasonal_data: List[Tuple[date, float]]) -> List[Tuple[date, float]]:
    """
    Combina datos reales de IRA con patrones estacionales
    Si hay datos reales, los usa con ajuste estacional
    Si no, usa patrón estacional puro
    """
    if not ira_data:
        return seasonal_data
    
    # Crear diccionarios
    ira_dict = {d: v for d, v in ira_data}
    seasonal_dict = {d: v for d, v in seasonal_data}
    
    # Combinar: 60% datos reales, 40% patrón estacional
    combined = []
    for d in sorted(set(list(ira_dict.keys()) + list(seasonal_dict.keys()))):
        ira_val = ira_dict.get(d, 0)
        seasonal_val = seasonal_dict.get(d, 0.5)
        
        if ira_val > 0:
            # Hay datos reales: combinar con estacionalidad
            health_idx = 0.6 * ira_val + 0.4 * seasonal_val
        else:
            # Solo estacionalidad
            health_idx = seasonal_val
        
        combined.append((d, health_idx))
    
    return combined

def fetch_health_daily(start: date, end: date, csv_fallback: str = "ml/data/health_ni.csv") -> Dict[str, dict]:
    """
    Obtiene índice de salud diario para predecir ventas de medicamentos en droguerías de Pasto
    
    El índice refleja:
    - Casos de IRA (Infección Respiratoria Aguda) en Nariño
    - Patrones estacionales de Pasto (lluvias, frío, Carnaval)
    - Picos esperados en demanda de antigripales, antifebriles, antibióticos
    
    Args:
        start: Fecha inicial
        end: Fecha final
        csv_fallback: Ruta a CSV de respaldo (opcional)
    
    Returns:
        Dict: {'YYYY-MM-DD': {'health_idx': float [0,1]}, ...}
        Valores altos (>0.7) = época de alta demanda de medicamentos para gripa
        Valores bajos (<0.4) = época de baja demanda
    """
    print(f"\n🏥 Obteniendo datos de salud para predicción de ventas en droguería")
    print(f"📅 Período: {start} a {end}")
    print(f"📍 Región: Pasto, Nariño")
    
    # 1. Intentar obtener datos reales de IRA
    ira_data = _fetch_ira_narino(start, end)
    
    # 2. Generar patrón estacional específico de Pasto
    seasonal_data = _generate_pasto_seasonal_pattern(start, end)
    print(f"✅ Patrón estacional de Pasto generado")
    
    # 3. Combinar datos reales con estacionalidad
    daily_raw = _aggregate_with_seasonality(ira_data, seasonal_data)
    
    # 4. Si no hay suficientes datos, intentar CSV fallback
    if not daily_raw or len(daily_raw) < 30:
        print(f"Pocos datos disponibles, intentando CSV fallback...")
        try:
            csv_data = _csv_weekly_fallback(csv_fallback)
            if csv_data:
                print(f"Cargados {len(csv_data)} registros desde CSV")
                daily_raw = csv_data
            else:
                daily_raw = seasonal_data
        except Exception as e:
            print(f"Error CSV: {e}. Usando patrón estacional")
            daily_raw = seasonal_data
    
    # 5. Normalizar valores [0, 1]
    vals = [v for _, v in daily_raw] if daily_raw else [0.5]
    vmin, vmax = min(vals), max(vals)
    
    if vmax > vmin:
        norm = lambda x: (x - vmin) / (vmax - vmin)
    else:
        norm = lambda x: 0.5
    
    # 6. Crear diccionario diario
    daily: Dict[str, dict] = {}
    
    for d, v in daily_raw:
        if start <= d <= end:
            daily[d.isoformat()] = {
                "health_idx": float(norm(v)),
                "raw_value": float(v)  # Valor sin normalizar para análisis
            }
    
    # 7. Rellenar días faltantes con interpolación
    current = start
    last_val = 0.5
    
    while current <= end:
        k = current.isoformat()
        if k not in daily:
            daily[k] = {
                "health_idx": last_val,
                "raw_value": last_val
            }
        else:
            last_val = daily[k]["health_idx"]
        current += timedelta(days=1)
    
    # 8. Resumen para el usuario
    print(f"\n📊 RESUMEN:")
    print(f"   Total días: {len(daily)}")
    if daily:
        values = [v["health_idx"] for v in daily.values()]
        print(f"   Índice promedio: {sum(values)/len(values):.2f}")
        print(f"   Índice mínimo: {min(values):.2f} (baja demanda)")
        print(f"   Índice máximo: {max(values):.2f} (alta demanda)")
        
        # Identificar períodos de alta demanda
        high_demand_days = [d for d, v in daily.items() if v["health_idx"] > 0.7]
        if high_demand_days:
            print(f"{len(high_demand_days)} días con demanda ALTA esperada")
    
    print(f"✅ Datos de salud listos para modelo ML\n")
    
    return daily

def _csv_weekly_fallback(csv_path: str) -> List[Tuple[date, float]]:
    """Carga datos desde CSV local como fallback"""
    if not os.path.exists(csv_path):
        return []
    
    rows = []
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                ws = date.fromisoformat(row["week_start"])
                v = float(row.get("cases", row.get("value", row.get("health_idx", 0))))
                rows.append((ws, v))
    except Exception:
        return []
    
    return rows

# Función para análisis de períodos críticos
def get_peak_periods(health_data: Dict[str, dict], threshold: float = 0.7) -> List[Tuple[date, date]]:
    """
    Identifica períodos continuos de alta demanda de medicamentos
    Útil para planificación de inventario en la droguería
    """
    peaks = []
    in_peak = False
    peak_start = None
    
    for date_str in sorted(health_data.keys()):
        current_date = date.fromisoformat(date_str)
        idx = health_data[date_str]["health_idx"]
        
        if idx >= threshold and not in_peak:
            in_peak = True
            peak_start = current_date
        elif idx < threshold and in_peak:
            in_peak = False
            peaks.append((peak_start, current_date))
    
    # Si termina en pico
    if in_peak:
        peaks.append((peak_start, date.fromisoformat(sorted(health_data.keys())[-1])))
    
    return peaks

# Función de prueba y análisis
if __name__ == "__main__":
    print("="*70)
    print("SISTEMA DE PREDICCIÓN DE DEMANDA - DROGUERÍA PASTO")
    print("Factor externo: Índice de Salud (IRA/Gripa)")
    print("="*70)
    
    # Período de prueba (últimos 6 meses)
    end_date = date.today()
    start_date = end_date - timedelta(days=180)
    
    # Obtener datos
    health_data = fetch_health_daily(start_date, end_date)
    
    # Análisis de períodos críticos
    print("\n🔍 ANÁLISIS DE PERÍODOS CRÍTICOS:")
    print("(Períodos de alta demanda de medicamentos para gripa)")
    
    peaks = get_peak_periods(health_data, threshold=0.7)
    if peaks:
        print(f"\nSe identificaron {len(peaks)} períodos de alta demanda:")
        for i, (inicio, fin) in enumerate(peaks, 1):
            duracion = (fin - inicio).days
            print(f"\n   {i}. {inicio} a {fin} ({duracion} días)")
            print(f"Recomendación: Aumentar stock de antigripales")
    else:
        print("\n   No hay períodos de demanda muy alta en el rango analizado")
    
    # Muestra de datos
    print("\n📋 MUESTRA DE DATOS (primeros 5 días):")
    sample_dates = sorted(health_data.keys())[:5]
    for d in sample_dates:
        idx = health_data[d]["health_idx"]
        nivel = "ALTA" if idx > 0.7 else "MEDIA" if idx > 0.4 else "BAJA"
        print(f"   {d}: {idx:.3f} - Demanda {nivel}")
    
    print("\n" + "="*70)