"""Fetch a pinned, trusted runtime bundle on CI. Never overwrite another model."""

import hashlib
import json
import os
import re
from io import BytesIO
from urllib.parse import urlparse
from zipfile import ZipFile

import httpx
from thermatwin.config import ROOT, required


def install_bundle(content: bytes, expected: dict):
    if not re.fullmatch(r"[A-Za-z0-9_]+", expected["dataset_id"]):
        raise ValueError("Dataset kimliği güvenli bir dosya adı olmalı.")
    if hashlib.sha256(content).hexdigest() != expected["bundle_sha256"]:
        raise ValueError("Model paketi SHA-256 uyuşmuyor.")
    with ZipFile(BytesIO(content)) as archive:
        if set(archive.namelist()) != {"model.joblib", "deployed-policy.json", "manifest.json"} or any(
            i.file_size > 30_000_000 for i in archive.infolist()
        ):
            raise ValueError("Model paketi içeriği geçersiz.")
        manifest = json.loads(archive.read("manifest.json"))
        if any(manifest[k] != expected[k] for k in ("dataset_id", "model_sha256", "policy_sha256")):
            raise ValueError("Model manifesti uyuşmuyor.")
        destinations = {
            "model.joblib": ROOT / "artifacts" / expected["dataset_id"] / "model.joblib",
            "deployed-policy.json": ROOT / "artifacts/reliability/v1/deployed-policy.json",
        }
        for name, path in destinations.items():
            value = archive.read(name)
            key = "model_sha256" if name == "model.joblib" else "policy_sha256"
            if hashlib.sha256(value).hexdigest() != expected[key] or (
                path.exists() and path.read_bytes() != value
            ):
                raise ValueError("Mevcut model/politika değiştirilmedi; hash uyuşmazlığı.")
        for name, path in destinations.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                path.write_bytes(archive.read(name))


def main():
    expected = json.loads((ROOT / "docs/runtime-model-manifest.json").read_text(encoding="utf-8"))
    url = required("MODEL_BUNDLE_URL")
    if urlparse(url).scheme != "https" or urlparse(url).username or urlparse(url).password:
        raise ValueError("Model URL HTTPS olmalı ve kimlik bilgisi içermemeli.")
    headers = {"Accept": "application/octet-stream"}
    if urlparse(url).hostname == "api.github.com" and os.getenv("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    with (
        httpx.Client(timeout=120, follow_redirects=True) as client,
        client.stream("GET", url, headers=headers) as response,
    ):
        response.raise_for_status()
        chunks = []
        size = 0
        for chunk in response.iter_bytes():
            size += len(chunk)
            if size > 30_000_000:
                raise ValueError("Model paketi çok büyük.")
            chunks.append(chunk)
    install_bundle(b"".join(chunks), expected)
    print("Trusted model and calibration bundle verified; no retraining.")


if __name__ == "__main__":
    main()
