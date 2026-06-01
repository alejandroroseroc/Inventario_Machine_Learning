# ml/cleaning.py
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import re
import unicodedata

class CSVCleaner:
    """
    Clase para limpiar y estandarizar CSVs de ventas/inventario de diferentes droguerías.
    Usa heurísticas para detectar columnas y tipos de datos.
    """
    
    # Mapeo de nombres comunes a campos estándar
    COLUMN_MAPS = {
        'codigo': [
            'cod', 'codigo', 'codigo_barras', 'codigo de barras',
            'c_digo_de_barras', 'cod_barras', 'cod barras', 'barcode', 'ean',
            'id_producto', 'sku', 'referencia', 'ref',
        ],
        'nombre': ['nombre', 'producto', 'descripcion', 'item', 'articulo'],
        'cantidad': [
            'cantidad', 'cantidad_vendida', 'cantidad vendida',
            'cant', 'qty', 'unidades', 'stock',
        ],
        'fecha': ['fecha', 'fecha_venta', 'fecha de venta', 'fec', 'date', 'momento', 'day'],
        'lote': ['lote', 'batch', 'nro_lote', 'serie'],
        'tipo_movimiento': ['tipo_movimiento', 'tipo movimento', 'tipo', 'movement'],
        'precio_costo': ['precio_costo', 'costo_compra', 'precio costo', 'costo', 'precio_vta', 'precio'],
        'precio_venta': [
            'precio_venta', 'precio_publico', 'pvp',
            'valor_unitario', 'precio_vta', 'valor_venta',
            'precio_cliente',
        ],
        'margen_ganancia': [
            'margen_ganancia', 'margen', 'ganancia',
            'porcentaje_ganancia', 'porcentaje de ganancia',
            'utilidad', 'margen_utilidad',
        ],
        'fecha_vencimiento': [
            'fecha_vencimiento', 'vencimiento', 'caducidad',
            'fecha_caducidad', 'expira', 'exp', 'vence',
            'fecha_exp',
        ],
        'es_historico': [
            'es_historico', 'historico', 'histórico',
            'venta_historica', 'venta histórica',
        ],
    }

    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.column_mapping: Dict[str, str] = {}
        self.errors: List[str] = []

    @staticmethod
    def _normalize_column_name(value) -> str:
        """Normaliza encabezados de CSV: tildes, espacios y simbolos."""
        text = str(value).strip().lower()
        text = unicodedata.normalize("NFKD", text)
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        text = re.sub(r"[^a-z0-9]+", "_", text)
        return text.strip("_")

    def _detect_columns(self):
        """Detecta qué columnas del DF corresponden a nuestros campos estándar."""
        for standard_name, synonyms in self.COLUMN_MAPS.items():
            valid_names = {
                self._normalize_column_name(name)
                for name in [standard_name] + synonyms
            }
            for col in self.df.columns:
                clean_col = self._normalize_column_name(col)
                if clean_col in valid_names:
                    self.column_mapping[standard_name] = col
                    break
        
        # Validación mínima
        required = ['codigo', 'cantidad']
        missing = [r for r in required if r not in self.column_mapping]
        if missing:
            self.errors.append(f"No se pudieron identificar las columnas obligatorias: {missing}")

    def _clean_numeric(self, series: pd.Series) -> pd.Series:
        """Limpia valores numéricos manejando comas/puntos y caracteres extra."""
        if series.dtype == object:
            # Eliminar símbolos de moneda y caracteres no numéricos excepto . , -
            series = series.astype(str).str.replace(r'[^\d,.-]', '', regex=True)
            # Manejar coma como separador decimal
            series = series.str.replace(',', '.')
        return pd.to_numeric(series, errors='coerce').fillna(0)

    def _clean_date(self, series: pd.Series) -> pd.Series:
        """Intenta parsear fechas en diversos formatos."""
        try:
            return pd.to_datetime(series, errors='coerce', format='mixed')
        except TypeError:
            return pd.to_datetime(series, errors='coerce')

    def clean(self) -> Tuple[pd.DataFrame, List[str]]:
        """Ejecuta el proceso completo de limpieza."""
        if self.df.empty:
            return self.df, ["El archivo está vacío"]

        self._detect_columns()
        if self.errors:
            return pd.DataFrame(), self.errors

        # Crear un nuevo dataframe estandarizado
        clean_df = pd.DataFrame()
        
        for std_name, orig_name in self.column_mapping.items():
            col_data = self.df[orig_name]
            
            if std_name in [
                'cantidad', 'precio', 'precio_costo', 'precio_venta',
                'margen_ganancia',
            ]:
                clean_df[std_name] = self._clean_numeric(col_data)
            elif std_name == 'es_historico':
                clean_df[std_name] = col_data.astype(str).str.strip().str.lower().isin(
                    ['1', 'true', 'si', 'sí', 'yes', 'y', 'historico', 'histórico']
                )
            elif std_name == 'fecha':
                clean_df[std_name] = self._clean_date(col_data)
            else:
                clean_df[std_name] = col_data.astype(str).str.strip()

        # Si no hay fecha, poner hoy
        if 'fecha' not in clean_df:
            clean_df['fecha'] = datetime.now()
        
        # Rellenar fechas que fallaron al parsear
        clean_df['fecha'] = clean_df['fecha'].fillna(datetime.now())

        # Detección de anomalías simple (Z-Score para cantidad)
        if 'cantidad' in clean_df and len(clean_df) > 3:
            q_mean = clean_df['cantidad'].mean()
            q_std = clean_df['cantidad'].std()
            if q_std > 0:
                # Marcar pero no eliminar (el usuario decidirá o el servicio filtrará)
                clean_df['es_anomalo'] = (clean_df['cantidad'] - q_mean).abs() > (3 * q_std)
            else:
                clean_df['es_anomalo'] = False

        # Eliminar filas donde cantidad sea <= 0 después de limpieza
        clean_df = clean_df[clean_df['cantidad'] > 0]

        return clean_df, self.errors

def clean_csv_file(file_path: str) -> Tuple[Optional[pd.DataFrame], List[str]]:
    """Helper para cargar y limpiar desde un path."""
    try:
        # Intentar con comas
        df = pd.read_csv(file_path, sep=None, engine='python')
        cleaner = CSVCleaner(df)
        return cleaner.clean()
    except Exception as e:
        return None, [f"Error al leer el archivo: {str(e)}"]
