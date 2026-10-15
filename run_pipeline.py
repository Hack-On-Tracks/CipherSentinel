#!/usr/bin/env python3
"""
run_pipeline.py  -  One-shot script to generate data, compute features,
                    build baselines, train the model, score all windows,
                    and evaluate the four methods.

Run from the repo root:
    python run_pipeline.py
"""
import subprocess, sys, os, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
ML   = os.path.join(HERE, "ml")
DATA = os.path.join(HERE, "data")

def run(script, *args):
    cmd = [sys.executable, os.path.join(ML, script)] + list(args)
    print(f"\n{'='*60}")
    print(f"  Running: {' '.join(cmd)}")
    print(f"{'='*60}")
    result = subprocess.run(cmd, cwd=HERE)
    if result.returncode != 0:
        print(f"[ERROR] {script} failed (exit {result.returncode})")
        sys.exit(result.returncode)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build metadata-only CipherSentinel artefacts.")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    run("generate.py", "--seed", str(args.seed), "--out_dir", DATA)
    run("features.py")
    run("baseline.py")
    run("train.py")
    run("score.py")
    run("evaluate.py")
    print("\n✅  Pipeline complete — data/ is ready, api/ can serve it.")
