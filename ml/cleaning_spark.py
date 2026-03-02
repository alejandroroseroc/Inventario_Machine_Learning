# ml/cleaning_spark.py
# Limpieza y estandarización de CSVs de ventas/inventario usando PySpark.
# Equivalente distribuido de cleaning.py para uso con datasets masivos.
# Se ejecuta aparte en un clúster Spark (no requiere Django).

from pyspark.sql import SparkSession, DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, DoubleType,
    TimestampType, BooleanType,
)
from typing import Dict, List, Optional, Tuple


# ── Mapeo de nombres comunes a campos estándar ───────────────────────────
COLUMN_MAPS: Dict[str, List[str]] = {
    "codigo":   ["cod", "codigo", "id_producto", "sku", "referencia", "ref"],
    "nombre":   ["nombre", "producto", "descripcion", "item", "articulo"],
    "cantidad": ["cantidad", "cant", "qty", "unidades", "stock"],
    "precio":   ["precio", "valor", "unitario", "costo", "price"],
    "fecha":    ["fecha", "fec", "date", "momento", "day"],
    "lote":     ["lote", "batch", "nro_lote", "serie"],
}


def _detect_column_mapping(columns: List[str]) -> Tuple[Dict[str, str], List[str]]:
    """
    Detecta qué columnas del DF corresponden a los campos estándar.
    Retorna (mapping, errores).
    """
    mapping: Dict[str, str] = {}
    errors: List[str] = []

    lower_cols = {c.lower().strip(): c for c in columns}

    for standard_name, synonyms in COLUMN_MAPS.items():
        for syn in [standard_name] + synonyms:
            if syn in lower_cols:
                mapping[standard_name] = lower_cols[syn]
                break

    required = ["codigo", "cantidad"]
    missing = [r for r in required if r not in mapping]
    if missing:
        errors.append(f"No se pudieron identificar las columnas obligatorias: {missing}")

    return mapping, errors


def clean_csv_spark(
    file_path: str,
    spark: Optional[SparkSession] = None,
) -> Tuple[Optional[DataFrame], List[str]]:
    """
    Carga y limpia un CSV masivo usando PySpark.

    Args:
        file_path: ruta al CSV (local, HDFS o S3)
        spark: sesión Spark existente (se crea una si no se provee)

    Returns:
        (DataFrame limpio, lista de errores)
    """
    if spark is None:
        spark = (
            SparkSession.builder
            .appName("Drogueria_CSV_Cleaner")
            .getOrCreate()
        )

    try:
        df = spark.read.csv(
            file_path,
            header=True,
            inferSchema=True,
            sep=None,
            encoding="utf-8",
        )
    except Exception as e:
        return None, [f"Error al leer el archivo: {str(e)}"]

    if df.rdd.isEmpty():
        return df, ["El archivo está vacío"]

    mapping, errors = _detect_column_mapping(df.columns)
    if errors:
        return None, errors

    # ── Renombrar y seleccionar columnas ─────────────────────────────────
    select_exprs = []
    for std_name, orig_name in mapping.items():
        if std_name in ("cantidad", "precio"):
            # Limpiar numéricos: quitar símbolos de moneda y convertir comas
            clean_col = (
                F.regexp_replace(F.col(orig_name).cast("string"), r"[^\d,.\-]", "")
            )
            clean_col = F.regexp_replace(clean_col, ",", ".")
            select_exprs.append(
                F.coalesce(clean_col.cast("double"), F.lit(0.0)).alias(std_name)
            )
        elif std_name == "fecha":
            select_exprs.append(
                F.coalesce(
                    F.to_timestamp(F.col(orig_name)),
                    F.current_timestamp()
                ).alias(std_name)
            )
        else:
            select_exprs.append(
                F.trim(F.col(orig_name).cast("string")).alias(std_name)
            )

    clean_df = df.select(*select_exprs)

    # Si no había columna fecha, agregar timestamp actual
    if "fecha" not in mapping:
        clean_df = clean_df.withColumn("fecha", F.current_timestamp())

    # ── Detección de anomalías (Z-Score distribuido) ─────────────────────
    if "cantidad" in mapping:
        stats = clean_df.agg(
            F.mean("cantidad").alias("q_mean"),
            F.stddev("cantidad").alias("q_std"),
            F.count("cantidad").alias("q_count"),
        ).collect()[0]

        q_mean = stats["q_mean"] or 0
        q_std = stats["q_std"] or 0
        q_count = stats["q_count"] or 0

        if q_count > 3 and q_std > 0:
            clean_df = clean_df.withColumn(
                "es_anomalo",
                F.abs(F.col("cantidad") - F.lit(q_mean)) > F.lit(3 * q_std)
            )
        else:
            clean_df = clean_df.withColumn("es_anomalo", F.lit(False))
    else:
        clean_df = clean_df.withColumn("es_anomalo", F.lit(False))

    # ── Filtrar filas con cantidad <= 0 ──────────────────────────────────
    clean_df = clean_df.filter(F.col("cantidad") > 0)

    return clean_df, []


# ── Punto de entrada para ejecución directa ──────────────────────────────
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Uso: spark-submit cleaning_spark.py <ruta_csv> [ruta_salida]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None

    result_df, errs = clean_csv_spark(input_path)

    if errs:
        print(f"Errores: {errs}")
        sys.exit(1)

    print(f"Filas limpias: {result_df.count()}")
    result_df.show(20, truncate=False)

    if output_path:
        result_df.write.mode("overwrite").parquet(output_path)
        print(f"Guardado en: {output_path}")
