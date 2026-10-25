"""Join the catalogue without changing source geometries. Python 3.11+."""
import argparse
import copy
import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path


def enrich(geo: dict, rows: list[dict]) -> tuple[dict, dict]:
    """Validate an exact many-to-one join; raise ValueError on ambiguity."""
    if geo.get("type") != "FeatureCollection" or not geo.get("features"):
        raise ValueError("Expected a nonempty FeatureCollection")
    crs = geo.get("crs", {}).get("properties", {}).get("name")
    if crs not in (None, "urn:ogc:def:crs:OGC:1.3:CRS84"):
        raise ValueError(f"Unsupported CRS: {crs}")
    catalog = {}
    for row in rows:
        name = row["NOMBRE_ART"]
        if not name or name in catalog:
            raise ValueError(f"Duplicate or empty catalogue key: {name}")
        catalog[name] = row
    counts = Counter(f["properties"]["NOMBRE_ART"] for f in geo["features"])
    if set(counts) != set(catalog):
        raise ValueError("Source and catalogue names do not match")
    for name, count in counts.items():
        if int(catalog[name]["N_TRAMOS"]) != count:
            raise ValueError(f"Frequency mismatch: {name}")
    out = copy.deepcopy(geo)
    # RFC 7946: longitude/latitude WGS84; no deprecated CRS member.
    out.pop("crs", None)
    for feature in out["features"]:
        geometry = feature.get("geometry") or {}
        kind = geometry.get("type")
        if kind not in ("LineString", "MultiLineString"):
            raise ValueError(f"Unsupported geometry: {kind}")
        lines = [geometry["coordinates"]] if kind == "LineString" else geometry["coordinates"]
        if not lines:
            raise ValueError("Empty geometry")
        for line in lines:
            if len(line) < 2:
                raise ValueError("Line must contain at least two coordinates")
            for point in line:
                if len(point) < 2 or not all(math.isfinite(v) for v in point):
                    raise ValueError("Invalid coordinate")
                if not (-180 <= point[0] <= 180 and -90 <= point[1] <= 90):
                    raise ValueError("Coordinates outside WGS84 bounds")
        props = feature["properties"]
        for field, value in catalog[props["NOMBRE_ART"]].items():
            if field == "NOMBRE_ART":
                continue
            if field in props and props[field] != value:
                raise ValueError(f"Property collision: {field}")
            props[field] = int(value) if field == "N_TRAMOS" else value
    report = {"features_in": len(geo["features"]), "features_out": len(out["features"]),
              "unique_names": len(counts), "unmatched": [], "rejected": [],
              "geometry_unchanged": all(a["geometry"] == b["geometry"] for a, b in zip(geo["features"], out["features"])),
              "crs": "OGC:CRS84 / WGS84 longitude, latitude", "join": "NOMBRE_ART exact",
              "states_by_name": dict(Counter(r["ESTADO"] for r in rows))}
    return out, report


def main() -> None:
    """Read inputs and atomically replace the validated output."""
    parser = argparse.ArgumentParser()
    parser.add_argument("geojson", type=Path)
    parser.add_argument("catalogue", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    geo = json.loads(args.geojson.read_text(encoding="utf-8"))
    with args.catalogue.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    result, report = enrich(geo, rows)
    report["source_sha256"] = hashlib.sha256(args.geojson.read_bytes()).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    temporary.replace(args.output)
    args.output.with_name("validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
