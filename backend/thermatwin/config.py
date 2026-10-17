from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
if os.getenv("APP_ENV", "development") in {"development", "test"} and os.getenv("VERCEL_ENV") != "preview":
    load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Region:
    id: str = "akkuyu"
    name: str = "Akkuyu açıkları, Mersin"
    lat: float = 36.05
    lon: float = 33.55
    south: float = 35.95
    north: float = 36.15
    west: float = 33.40
    east: float = 33.70


REGION = Region()
DATASET = os.getenv("COPERNICUS_DATASET_ID", "SST_MED_SST_L4_NRT_OBSERVATIONS_010_004_c_V2")
VARIABLE = os.getenv("COPERNICUS_VARIABLE", "analysed_sst")


def required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"Eksik yapılandırma: {name}. .env.example dosyasına bakın.")
    return value
