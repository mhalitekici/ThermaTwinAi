"""Scheduled/manual Copernicus monitoring. Default shadow; no training."""

import hashlib
import json
import os
import uuid
from datetime import UTC, datetime

import joblib
from thermatwin.config import DATASET, ROOT, required
from thermatwin.ingest import download_copernicus
from thermatwin.monitoring import run_once
from thermatwin.pipeline import write_snapshot
from thermatwin.store import Store


def main():
    required("SUPABASE_URL")
    required("SUPABASE_SERVICE_ROLE_KEY")
    run_key = (
        f"github-{os.environ['GITHUB_RUN_ID']}-{os.getenv('GITHUB_RUN_ATTEMPT', '1')}"
        if os.getenv("GITHUB_RUN_ID")
        else f"manual-{uuid.uuid4()}"
    )
    trigger = os.getenv("GITHUB_EVENT_NAME", "manual")
    with Store() as store:
        try:
            model_path = ROOT / "artifacts" / DATASET / "model.joblib"
            if not model_path.exists():
                from prepare_monitor_model import main as prepare_model

                prepare_model()
            manifest = json.loads((ROOT / "docs/runtime-model-manifest.json").read_text(encoding="utf-8"))
            if hashlib.sha256(model_path.read_bytes()).hexdigest() != manifest["model_sha256"]:
                raise ValueError("Monitoring modeli hash kontrolünden geçemedi.")
            if (
                hashlib.sha256(
                    (ROOT / "artifacts/reliability/v1/deployed-policy.json").read_bytes()
                ).hexdigest()
                != manifest["policy_sha256"]
            ):
                raise ValueError("Monitoring kalibrasyonu hash kontrolünden geçemedi.")
            bundle = joblib.load(model_path)
            frame, source = download_copernicus()
            snap, counts = run_once(store, frame, source, bundle, run_key=run_key, trigger=trigger)
            write_snapshot(snap, ROOT / "artifacts/live.json")
            print(json.dumps({"date": snap["origin_date"], "stale": snap["stale"], "counts": counts}))
            if counts["failed"]:
                raise RuntimeError("Gönderim hatası; kayıtları kontrol edin.")
        except Exception as exc:  # noqa: BLE001 -- scrub provider errors before CI logging.
            store.upsert(
                "monitor_runs",
                [
                    {
                        "run_key": run_key,
                        "status": "failed",
                        "detail": json.dumps({"error_class": type(exc).__name__}),
                        "finished_at": datetime.now(UTC).isoformat(),
                    }
                ],
                "run_key",
            )
            raise RuntimeError(f"Monitoring failed ({type(exc).__name__}); inspect monitor_runs") from None


if __name__ == "__main__":
    main()
