"""Apply a SQL file to Supabase via the Management API.

Usage:
    python scripts/apply_sql.py packages/db/drizzle/0000_init.sql
"""
import json
import os
import sys
import urllib.request
import urllib.error

PROJECT_REF = "lkngyjkrhgtxnebpepie"
TOKEN = os.environ["SUPABASE_MANAGEMENT_TOKEN"]


def run_sql(query: str) -> str:
    body = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=body,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "heatflow-bootstrap/0.1 (+https://heatflow.local)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {e.code} {e.reason}\n{body_txt}")


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: python apply_sql.py <file.sql>")
    path = sys.argv[1]
    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()
    print(f"Applying {path} ({len(sql):,} chars)...")
    out = run_sql(sql)
    print(out[:500] if out else "(no output)")
    print("OK")


if __name__ == "__main__":
    main()
