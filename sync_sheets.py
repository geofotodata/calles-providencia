"""Sincroniza el catálogo de Google Sheets con catalogo.csv y calles.geojson. Python 3.10+"""
import argparse
import csv
import json
import os
import sys
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def sync(source: str) -> None:
    # 1. Obtener filas del catálogo
    if source.startswith("http://") or source.startswith("https://"):
        print(f"Descargando catálogo desde Google Sheets: {source}")
        req = urllib.request.Request(source, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            raw_text = resp.read().decode("utf-8")
        rows = list(csv.DictReader(raw_text.splitlines()))
        # Guardar en catalogo.csv manteniendo UTF-8 con BOM
        (ROOT / "catalogo.csv").write_text(raw_text, encoding="utf-8-sig")
        print("✓ catalogo.csv actualizado exitosamente.")
    else:
        csv_file = Path(source)
        if not csv_file.is_absolute():
            csv_file = ROOT / csv_file
        with csv_file.open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))

    if not rows:
        raise ValueError("El catálogo recibido está vacío.")

    if len(rows) != 465:
        print(f"ADVERTENCIA: Se esperaban 465 registros, pero el catálogo tiene {len(rows)} filas.")

    catalog = {}
    for r in rows:
        name = r.get("NOMBRE_ART", "").strip()
        if not name:
            continue
        catalog[name] = r

    # 2. Cargar y actualizar calles.geojson
    geo_path = ROOT / "calles.geojson"
    if not geo_path.exists():
        raise FileNotFoundError(f"No se encontró {geo_path}")

    geo = json.loads(geo_path.read_text(encoding="utf-8"))
    updated_count = 0

    fields_to_sync = [
        "REFERENTE",
        "DESCRIPCION",
        "ESTADO",
        "TEMA",
        "FUENTE",
        "URL_FUENTE",
        "NOTAS",
        "TEXTO_POPUP",
        "FECHA_REV",
    ]

    for feature in geo.get("features", []):
        props = feature.get("properties", {})
        name = props.get("NOMBRE_ART")
        if name in catalog:
            cat_row = catalog[name]
            for key in fields_to_sync:
                if key in cat_row and cat_row[key] is not None:
                    props[key] = cat_row[key]
            updated_count += 1

    # Guardar calles.geojson de forma atómica
    tmp_geo = geo_path.with_suffix(".tmp")
    tmp_geo.write_text(json.dumps(geo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp_geo.replace(geo_path)
    print(f"✓ calles.geojson actualizado exitosamente ({updated_count} tramos procesados).")

    # 3. Actualizar conteos en validation.json si existe
    val_path = ROOT / "validation.json"
    if val_path.exists():
        try:
            val = json.loads(val_path.read_text(encoding="utf-8"))
            val["states_by_name"] = dict(Counter(r.get("ESTADO", "PENDIENTE") for r in rows))
            val_path.write_text(json.dumps(val, ensure_ascii=False, indent=2), encoding="utf-8")
            print("✓ validation.json actualizado con la nueva distribución de estados.")
        except Exception as e:
            print(f"Aviso: no se pudo actualizar validation.json ({e})")

    print("\n¡Sincronización completada con éxito!")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sincronizar Google Sheets con el atlas de calles.")
    parser.add_argument(
        "source",
        nargs="?",
        default=os.environ.get("GOOGLE_SHEETS_CSV_URL", str(ROOT / "catalogo.csv")),
        help="URL de publicación CSV de Google Sheets o ruta local a catalogo.csv",
    )
    args = parser.parse_args()
    sync(args.source)


if __name__ == "__main__":
    main()
