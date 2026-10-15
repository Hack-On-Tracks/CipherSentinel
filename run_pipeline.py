#!/usr/bin/env python3
"""
run_pipeline.py  -  Unified pipeline runner for CipherSentinel.

Supports both:
1. Default deterministic demo workflow (synthetic data with seed 42):
     python run_pipeline.py
2. Real-data Zeek log workflow:
     python run_pipeline.py --mode real --conn-log path/to/conn.log --ssl-log path/to/ssl.log
3. Generic Flow CSV fallback workflow:
     python run_pipeline.py --mode csv --flow-csv path/to/flows.csv
"""

import argparse
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ML = os.path.join(HERE, "ml")
DEFAULT_DATA = os.path.join(HERE, "data")


def run_script(script, *args):
    cmd = [sys.executable, os.path.join(ML, script)] + list(args)
    print(f"\n{'='*60}")
    print(f"  Running: {' '.join(cmd)}")
    print(f"{'='*60}")
    result = subprocess.run(cmd, cwd=HERE)
    if result.returncode != 0:
        print(f"[ERROR] {script} failed with exit code {result.returncode}")
        sys.exit(result.returncode)


def main():
    parser = argparse.ArgumentParser(
        description="Run CipherSentinel end-to-end detection pipeline on synthetic or real network data."
    )
    parser.add_argument(
        "--mode",
        choices=["synthetic", "real", "csv"],
        default="synthetic",
        help="Pipeline mode: 'synthetic' (default demo), 'real' (Zeek logs), or 'csv' (flow CSV)",
    )
    # Synthetic options
    parser.add_argument("--seed", type=int, default=42, help="Random seed for synthetic generation")

    # Real Zeek options
    parser.add_argument("--conn-log", help="Path to Zeek conn.log (TSV or JSON)")
    parser.add_argument("--ssl-log", help="Path to Zeek ssl.log (TSV or JSON)")

    # Flow CSV options
    parser.add_argument("--flow-csv", help="Path to generic flow CSV")

    # Shared real data options
    parser.add_argument("--identity-map", help="Path to IP-to-entity mapping CSV or JSON")
    parser.add_argument("--labels", help="Path to ground truth labels CSV")
    parser.add_argument("--dataset-id", default=None, help="Identifier for dataset manifest")
    parser.add_argument("--provenance", default=None, help="Description of data provenance")
    parser.add_argument("--license", default=None, help="Data license statement")
    parser.add_argument("--train-split", type=float, default=0.7, help="Chronological training split fraction (default: 0.7)")
    parser.add_argument("--train-until", type=str, default=None, help="Timestamp cutoff for training period (ISO format)")
    parser.add_argument(
        "--assume-benign-history",
        action="store_true",
        help="Assume training period is clean for unlabeled real data baseline fitting",
    )
    parser.add_argument("--out-dir", default=None, help="Output directory (default: 'data' for synthetic, 'data/real' for real)")

    args = parser.parse_args()

    if args.mode == "synthetic":
        out_dir = args.out_dir or DEFAULT_DATA
        os.makedirs(out_dir, exist_ok=True)
        run_script("generate.py", "--seed", str(args.seed), "--out_dir", out_dir)
        run_script("features.py", "--flows", os.path.join(out_dir, "flows.csv"), "--out-dir", out_dir)
        run_script("baseline.py", "--features", os.path.join(out_dir, "features_15m.csv"), "--out-dir", out_dir)
        run_script("train.py", "--features", os.path.join(out_dir, "features_15m.csv"), "--user-bl", os.path.join(out_dir, "baselines_user.json"), "--out-dir", out_dir)
        run_script("score.py", "--features", os.path.join(out_dir, "features_15m.csv"), "--data-dir", out_dir)
        run_script("evaluate.py", "--data-dir", out_dir)
        print(f"\n✅  Synthetic demo pipeline complete — artifacts ready in {out_dir}/")

    elif args.mode == "real":
        if not args.conn_log:
            parser.error("--conn-log is required when --mode real is selected.")
        out_dir = args.out_dir or os.path.join(DEFAULT_DATA, "real")
        os.makedirs(out_dir, exist_ok=True)

        ingest_args = ["--conn-log", args.conn_log, "--out-dir", out_dir]
        if args.ssl_log:
            ingest_args += ["--ssl-log", args.ssl_log]
        if args.identity_map:
            ingest_args += ["--identity-map", args.identity_map]
        if args.labels:
            ingest_args += ["--labels", args.labels]
        if args.dataset_id:
            ingest_args += ["--dataset-id", args.dataset_id]
        if args.provenance:
            ingest_args += ["--provenance", args.provenance]
        if args.license:
            ingest_args += ["--license", args.license]

        run_script("ingest.py", *ingest_args)
        run_script("features.py", "--flows", os.path.join(out_dir, "flows.csv"), "--out-dir", out_dir)

        baseline_args = ["--features", os.path.join(out_dir, "features_15m.csv"), "--out-dir", out_dir]
        if args.train_split:
            baseline_args += ["--train-split", str(args.train_split)]
        if args.train_until:
            baseline_args += ["--train-until", args.train_until]
        if args.assume_benign_history:
            baseline_args.append("--assume-benign-history")
        run_script("baseline.py", *baseline_args)

        train_args = [
            "--features", os.path.join(out_dir, "features_15m.csv"),
            "--user-bl", os.path.join(out_dir, "baselines_user.json"),
            "--out-dir", out_dir,
        ]
        if args.train_split:
            train_args += ["--train-split", str(args.train_split)]
        if args.train_until:
            train_args += ["--train-until", args.train_until]
        if args.assume_benign_history:
            train_args.append("--assume-benign-history")
        run_script("train.py", *train_args)

        run_script("score.py", "--features", os.path.join(out_dir, "features_15m.csv"), "--data-dir", out_dir)
        run_script("evaluate.py", "--data-dir", out_dir)
        print(f"\n✅  Real-data pipeline complete — artifacts ready in {out_dir}/")

    elif args.mode == "csv":
        if not args.flow_csv:
            parser.error("--flow-csv is required when --mode csv is selected.")
        out_dir = args.out_dir or os.path.join(DEFAULT_DATA, "real")
        os.makedirs(out_dir, exist_ok=True)

        ingest_args = ["--flow-csv", args.flow_csv, "--out-dir", out_dir]
        if args.identity_map:
            ingest_args += ["--identity-map", args.identity_map]
        if args.dataset_id:
            ingest_args += ["--dataset-id", args.dataset_id]
        if args.provenance:
            ingest_args += ["--provenance", args.provenance]
        if args.license:
            ingest_args += ["--license", args.license]

        run_script("ingest.py", *ingest_args)
        run_script("features.py", "--flows", os.path.join(out_dir, "flows.csv"), "--out-dir", out_dir)

        baseline_args = ["--features", os.path.join(out_dir, "features_15m.csv"), "--out-dir", out_dir]
        if args.train_split:
            baseline_args += ["--train-split", str(args.train_split)]
        if args.train_until:
            baseline_args += ["--train-until", args.train_until]
        if args.assume_benign_history:
            baseline_args.append("--assume-benign-history")
        run_script("baseline.py", *baseline_args)

        train_args = [
            "--features", os.path.join(out_dir, "features_15m.csv"),
            "--user-bl", os.path.join(out_dir, "baselines_user.json"),
            "--out-dir", out_dir,
        ]
        if args.train_split:
            train_args += ["--train-split", str(args.train_split)]
        if args.train_until:
            train_args += ["--train-until", args.train_until]
        if args.assume_benign_history:
            train_args.append("--assume-benign-history")
        run_script("train.py", *train_args)

        run_script("score.py", "--features", os.path.join(out_dir, "features_15m.csv"), "--data-dir", out_dir)
        run_script("evaluate.py", "--data-dir", out_dir)
        print(f"\n✅  Flow CSV pipeline complete — artifacts ready in {out_dir}/")


if __name__ == "__main__":
    main()
