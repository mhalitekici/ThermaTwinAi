"""No-send local/remote integration preflight; safe to run before entering credentials."""

import argparse
import json
import os
from pathlib import Path

from dotenv import dotenv_values
from thermatwin.integration_check import check_integrations


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Salt okunur kontrol; OTP/e-posta göndermez, veritabanını değiştirmez."
    )
    parser.add_argument(
        "--remote", action="store_true", help="Yerel ayarlar tamamsa Supabase GET kontrollerini de çalıştır."
    )
    parser.add_argument("--json", action="store_true", help="Değer içermeyen JSON raporu yazdır.")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    # Never create, edit or echo the user's .env. Environment variables take precedence.
    env = {**dotenv_values(root / ".env"), **os.environ}
    result = check_integrations(env, remote=args.remote)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        for check in result["checks"]:
            print(f"[{check['status'].upper()}] {check['name']}: {check['message']}")
        print("Gönderilen e-posta: 0. Canlı kullanıcı kabul testi: doğrulanmadı.")
    return int(not result["local_ready"] or (args.remote and result["remote_ready"] is not True))


if __name__ == "__main__":
    raise SystemExit(main())
