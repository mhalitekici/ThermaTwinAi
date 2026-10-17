"""Package only the existing trusted model and calibration; never fit a model."""

import hashlib
import json
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

from thermatwin.config import DATASET, ROOT


def package():
    model = (ROOT / "artifacts" / DATASET / "model.joblib").read_bytes()
    policy = (ROOT / "artifacts/reliability/v1/deployed-policy.json").read_bytes()
    model_hash = hashlib.sha256(model).hexdigest()
    if json.loads(policy)["model_sha256"] != model_hash:
        raise ValueError("Model/politika uyuşmuyor.")
    manifest = {
        "dataset_id": DATASET,
        "model_sha256": model_hash,
        "policy_sha256": hashlib.sha256(policy).hexdigest(),
    }
    target = ROOT / "artifacts/thermatwin-runtime.zip"
    with ZipFile(target, "w", compression=ZIP_DEFLATED) as archive:
        for name, content in {
            "model.joblib": model,
            "deployed-policy.json": policy,
            "manifest.json": json.dumps(manifest, sort_keys=True).encode(),
        }.items():
            info = ZipInfo(name, date_time=(2026, 10, 16, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            archive.writestr(info, content)
    manifest["bundle_sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
    (ROOT / "docs/runtime-model-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"bundle": "artifacts/thermatwin-runtime.zip", **manifest}))


if __name__ == "__main__":
    package()
