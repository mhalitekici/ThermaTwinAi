"""Provider-specific input. No interpolation and no unlabeled provider mixing."""

from datetime import date, datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
from urllib.parse import quote

import httpx
import numpy as np
import pandas as pd
import xarray as xr

from .config import DATASET, REGION, ROOT, VARIABLE, required


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean_daily(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()
    frame["date"] = pd.to_datetime(frame["date"], utc=True).dt.tz_localize(None).dt.normalize()
    frame["sst_c"] = pd.to_numeric(frame["sst_c"], errors="coerce")
    frame.loc[~frame.sst_c.between(-2, 40), "sst_c"] = np.nan
    if frame.date.duplicated().any():
        raise ValueError("Aynı güne ait birden fazla gözlem var; kaynakları açıkça uzlaştırın.")
    frame = frame.sort_values("date").set_index("date")
    if frame.empty or frame.sst_c.notna().sum() == 0:
        raise ValueError("Geçerli deniz hücresi/gözlem bulunamadı.")
    # Keep missing calendar days missing: a lag always means a calendar day.
    return frame.reindex(pd.date_range(frame.index.min(), frame.index.max(), freq="D", name="date"))


def extract_netcdf(path: Path, variable: str = VARIABLE) -> pd.DataFrame:
    with xr.open_dataset(path, mask_and_scale=True) as ds:
        ds = ds.rename({k: v for k, v in {"latitude": "lat", "longitude": "lon"}.items() if k in ds})
        ds = (
            ds.sortby("lat")
            .sortby("lon")
            .sel(lat=slice(REGION.south, REGION.north), lon=slice(REGION.west, REGION.east))
        )
        if variable not in ds or not {"time", "lat", "lon"}.issubset(ds[variable].dims):
            raise ValueError(f"Beklenen time/lat/lon boyutları veya {variable} yok.")
        sst = ds[variable]
        units = str(sst.attrs.get("units", "")).lower().strip()
        if units in {"k", "kelvin", "degrees_k"}:
            sst = sst - 273.15
        elif units not in {"c", "celsius", "degree_celsius", "degrees_celsius", "degc", "degree_c"}:
            raise ValueError(f"Bilinmeyen sıcaklık birimi: {units!r}")
        if "mask" not in ds:
            raise ValueError("Kara maskesi yok; kıyı verisi sessizce kabul edilmedi.")
        # GHRSST mask: 1 = open sea. Exclude land, lake, ice and invalid cells.
        sst = sst.where(ds["mask"] == 1).where((sst >= -2) & (sst <= 40))
        weights = np.cos(np.deg2rad(ds.lat))
        daily = sst.weighted(weights).mean(("lat", "lon"), skipna=True)
        if set(daily.dims) != {"time"}:
            raise ValueError("Beklenmeyen ek boyut; kaynak ürününü kontrol edin.")
        valid = sst.notnull().sum(("lat", "lon"))
        return clean_daily(
            pd.DataFrame({"date": ds.time.values, "sst_c": daily.values, "valid_cells": valid.values})
        )


def download_copernicus(start: str = "2008-01-01", end: str | None = None) -> tuple[pd.DataFrame, dict]:
    import copernicusmarine

    # The catalogue also publishes openly readable ARCO Zarr. Use that documented
    # resource when no account is configured; never substitute a different dataset.
    access = os.getenv("COPERNICUS_ACCESS", "auto")
    if access == "public" or (access == "auto" and not os.getenv("COPERNICUSMARINE_SERVICE_USERNAME")):
        return download_copernicus_public(start, end)
    username = required("COPERNICUSMARINE_SERVICE_USERNAME")
    password = required("COPERNICUSMARINE_SERVICE_PASSWORD")
    raw = ROOT / "data/raw/copernicus"
    raw.mkdir(parents=True, exist_ok=True)
    end = end or date.today().isoformat()
    frames, files = [], []
    # Year chunks are resumable. Files ending before the current year are immutable cache entries.
    for year in range(pd.Timestamp(start).year, pd.Timestamp(end).year + 1):
        lo = max(start, f"{year}-01-01")
        hi = min(end, f"{year}-12-31")
        product_key = hashlib.sha256(DATASET.encode()).hexdigest()[:10]
        name = f"{product_key}_{lo}_{hi}.nc"
        target = raw / name
        if not target.exists() or year == date.today().year:
            copernicusmarine.subset(
                dataset_id=DATASET,
                variables=[VARIABLE, "mask"],
                minimum_longitude=REGION.west,
                maximum_longitude=REGION.east,
                minimum_latitude=REGION.south,
                maximum_latitude=REGION.north,
                start_datetime=lo,
                end_datetime=hi + "T23:59:59",
                username=username,
                password=password,
                output_directory=str(raw),
                output_filename=name,
                overwrite=True,
                skip_existing=False,
            )
        frames.append(extract_netcdf(target))
        files.append({"file": name, "sha256": sha256(target)})
    combined = clean_daily(pd.concat(frames).reset_index())
    meta = {
        "provider": "Copernicus Marine",
        "dataset_id": DATASET,
        "variable": VARIABLE,
        "resolution": "0.01°",
        "aggregation": "cos(latitude)-weighted open-sea ROI mean",
        "region_id": REGION.id,
        "bounds": [REGION.south, REGION.west, REGION.north, REGION.east],
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "files": files,
        "catalog_url": "https://data.marine.copernicus.eu/product/SST_MED_SST_L4_NRT_OBSERVATIONS_010_004/services",
    }
    save_series(combined, meta, "copernicus")
    return combined, meta


def download_copernicus_public(start: str, end: str | None = None) -> tuple[pd.DataFrame, dict]:
    import copernicusmarine

    catalogue = copernicusmarine.describe(dataset_id=DATASET, disable_progress_bar=True)
    dataset = next(d for p in catalogue.products for d in p.datasets if d.dataset_id == DATASET)
    version = dataset.versions[0]
    service = next(s for part in version.parts for s in part.services if s.service_short_name == "timeseries")
    raw = ROOT / "data/raw/copernicus"
    raw.mkdir(parents=True, exist_ok=True)
    with xr.open_zarr(service.uri, consolidated=True, zarr_format=2) as ds:
        latest = pd.Timestamp(ds.time.values[-1]).date().isoformat()
        end = min(end or latest, latest)
        if start > end:
            raise ValueError("İstenen aralıkta Copernicus gözlemi yok.")
        subset = ds[[VARIABLE, "mask"]].sel(
            latitude=slice(REGION.south, REGION.north),
            longitude=slice(REGION.west, REGION.east),
            time=slice(start, end),
        )
        # Store the exact regional NetCDF used by the common unit/mask validator.
        path = raw / f"public_{version.label}_{start}_{end}.nc"
        if not path.exists():
            subset.load().to_netcdf(path)
    frame = extract_netcdf(path)
    meta = {
        "provider": "Copernicus Marine",
        "dataset_id": DATASET,
        "dataset_version": version.label,
        "variable": VARIABLE,
        "resolution": "~1 km (catalogue 0.01°)",
        "access": "public catalogue ARCO Zarr",
        "aggregation": "cos(latitude)-weighted open-sea ROI mean",
        "region_id": REGION.id,
        "bounds": [REGION.south, REGION.west, REGION.north, REGION.east],
        "url": service.uri,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "sha256": sha256(path),
        "catalogue_last_observation": latest,
        "catalog_url": "https://data.marine.copernicus.eu/product/SST_MED_SST_L4_NRT_OBSERVATIONS_010_004/services",
    }
    save_series(frame, meta, "copernicus")
    return frame, meta


def download_noaa(start: str = "2008-01-01", end: str = "2025-12-31") -> tuple[pd.DataFrame, dict]:
    """Credential-free comparison only; not a substitute labeled as Copernicus."""
    base = "https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncdcOisst21Agg_LonPM180.csv"
    query = f"sst[({start}T12:00:00Z):1:({end}T12:00:00Z)][(0.0)][(35.875)][(33.625)]"
    url = base + "?" + quote(query, safe="[]():,.-")
    with httpx.Client(timeout=180, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
    raw = ROOT / "data/raw/noaa"
    raw.mkdir(parents=True, exist_ok=True)
    path = raw / f"oisst_{start}_{end}.csv"
    path.write_text(response.text, encoding="utf-8")
    csv = pd.read_csv(io.StringIO(response.text), skiprows=[1])
    units = pd.read_csv(io.StringIO(response.text), nrows=1).iloc[0]
    if units["sst"] != "degree_C":
        raise ValueError("NOAA sıcaklık birimi doğrulanamadı.")
    frame = clean_daily(csv.rename(columns={"time": "date", "sst": "sst_c"})[["date", "sst_c"]])
    meta = {
        "provider": "NOAA OISST v2.1 · karşılaştırma verisi",
        "dataset_id": "ncdcOisst21Agg_LonPM180",
        "variable": "sst",
        "resolution": "0.25° (~28 km)",
        "aggregation": "single offshore grid cell",
        "latitude": float(csv.latitude.iloc[0]),
        "longitude": float(csv.longitude.iloc[0]),
        "region_id": REGION.id,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "url": url,
        "sha256": sha256(path),
        "catalog_url": "https://coastwatch.pfeg.noaa.gov/erddap/info/ncdcOisst21Agg_LonPM180/index.html",
        "limitation": "Copernicus değildir. Kaba açık-deniz hücresi; kıyı veya deşarj etkisini çözemez.",
    }
    save_series(frame, meta, "noaa")
    return frame, meta


def save_series(frame: pd.DataFrame, meta: dict, provider: str) -> None:
    target = ROOT / "data/processed"
    target.mkdir(parents=True, exist_ok=True)
    frame.to_csv(target / f"{provider}.csv", index_label="date")
    meta["first_observation"] = frame.index.min().date().isoformat()
    meta["last_observation"] = frame.sst_c.last_valid_index().date().isoformat()
    meta["valid_days"] = int(frame.sst_c.notna().sum())
    meta["missing_days"] = int(frame.sst_c.isna().sum())
    (target / f"{provider}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def load_series(provider: str) -> tuple[pd.DataFrame, dict]:
    target = ROOT / "data/processed"
    frame = clean_daily(pd.read_csv(target / f"{provider}.csv"))
    meta = json.loads((target / f"{provider}.json").read_text(encoding="utf-8"))
    return frame, meta
