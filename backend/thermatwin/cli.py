import argparse
import json
import os

import joblib

from .config import ROOT
from .ingest import download_copernicus, download_noaa, load_series
from .mail import deliver
from .model import train
from .pipeline import publish, replay_path, select_replay, snapshot, write_snapshot
from .store import Store


def main():
    p = argparse.ArgumentParser(description="ThermaTwin SST pipeline")
    p.add_argument("command", choices=["download", "train", "replay", "monitor"])
    p.add_argument("--provider", choices=["copernicus", "noaa"], default="copernicus")
    p.add_argument("--start", default="2008-01-01")
    p.add_argument("--end")
    p.add_argument("--origin")
    p.add_argument("--publish", action="store_true")
    p.add_argument("--send-email", action="store_true")
    p.add_argument("--user-id", help="Replay: single subscribed, verified account; server-side operator only")
    args = p.parse_args()
    if args.command == "download":
        if args.provider == "noaa":
            frame, meta = download_noaa(args.start, args.end or "2025-12-31")
        else:
            frame, meta = download_copernicus(args.start, args.end)
        print(json.dumps(meta, ensure_ascii=False, indent=2))
        return
    if args.command == "monitor":
        if args.provider != "copernicus":
            p.error("Canlı monitoring için Copernicus gereklidir.")
        frame, source = download_copernicus(args.start, args.end)
    else:
        frame, source = load_series(args.provider)
    folder = ROOT / "artifacts" / source["dataset_id"]
    if args.command == "train":
        bundle = train(frame, source, folder)
        print(json.dumps(bundle["evaluation"], ensure_ascii=False, indent=2))
        return
    model_path = folder / "model.joblib"
    if not model_path.exists():
        raise ValueError("Önce aynı sağlayıcı için train komutunu çalıştırın.")
    bundle = joblib.load(model_path)  # Local artifact only; never accept uploaded pickle files.
    if bundle["source"]["dataset_id"] != source["dataset_id"]:
        raise ValueError("Model/veri kaynağı uyuşmuyor.")
    bundle["source"] = source
    mode = "replay" if args.command == "replay" else "live"
    origin = args.origin or (select_replay(frame, bundle) if mode == "replay" else None)
    snap = snapshot(frame, bundle, mode, origin)
    if mode == "replay":
        write_snapshot(snap, replay_path())
    else:
        write_snapshot(snap, ROOT / "artifacts/live.json")
        write_snapshot(snap, ROOT / "public/live.json")
    print(
        f"{mode}: observation={snap['origin_date']}, source={source['provider']}, reports={len(snap['reports'])}"
    )
    if args.send_email and mode == "replay" and not args.user_id:
        p.error("Replay e-postası için --user-id gerekli.")
    if args.publish or args.send_email or (mode == "live" and os.getenv("SUPABASE_URL")):
        with Store() as store:
            alerts = publish(store, frame, snap)
            if args.send_email:
                for alert in alerts:
                    print(deliver(store, alert, args.user_id, manual_test=mode == "replay"))
            store.request(
                "POST",
                "/rest/v1/monitor_runs",
                json={
                    "status": "stale" if snap["stale"] else "ok",
                    "detail": mode,
                    "observation_date": snap["origin_date"],
                },
            )


if __name__ == "__main__":
    main()
