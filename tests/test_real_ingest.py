"""
Tests for real data ingestion, Zeek parsing, flow normalization, and pipeline execution.
"""

import json
import os
import shutil
import tempfile
import pytest
import pandas as pd

from ml.ingest import (
    detect_zeek_format,
    ingest_flow_csv,
    ingest_zeek,
    load_zeek_log,
    match_dest_category,
    parse_zeek_json,
    parse_zeek_tsv,
    pseudonymize_ip,
    write_manifest,
)
from ml import features, baseline, train, score, evaluate

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "zeek")


def test_detect_zeek_format():
    assert detect_zeek_format(os.path.join(FIXTURES_DIR, "conn.log")) == "tsv"
    assert detect_zeek_format(os.path.join(FIXTURES_DIR, "conn.json")) == "json"


def test_parse_zeek_tsv():
    df = parse_zeek_tsv(os.path.join(FIXTURES_DIR, "conn.log"))
    assert not df.empty
    assert "uid" in df.columns
    assert "id.orig_h" in df.columns
    assert len(df) == 6
    assert df["id.orig_h"].iloc[0] == "192.0.2.10"
    # Unset fields represented as None
    assert df["tunnel_parents"].iloc[0] is None


def test_parse_zeek_json():
    df = parse_zeek_json(os.path.join(FIXTURES_DIR, "conn.json"))
    assert not df.empty
    assert "uid" in df.columns
    assert len(df) == 3


def test_pseudonymize_ip():
    p1 = pseudonymize_ip("192.0.2.10")
    p2 = pseudonymize_ip("192.0.2.10")
    p3 = pseudonymize_ip("192.0.2.11")
    assert p1 == p2
    assert p1 != p3
    assert p1.startswith("U-IP-")


def test_match_dest_category():
    assert match_dest_category("github.com") == "sanctioned"
    assert match_dest_category("sub.mega.nz") == "personal_file_sharing"
    assert match_dest_category("wetransfer.com") == "file_transfer"
    assert match_dest_category("unknown-domain-xyz.biz") == "unknown"
    assert match_dest_category("unknown") == "unknown"


def test_ingest_zeek_tsv_end_to_end():
    conn_path = os.path.join(FIXTURES_DIR, "conn.log")
    ssl_path = os.path.join(FIXTURES_DIR, "ssl.log")
    id_map = os.path.join(FIXTURES_DIR, "identity_map.csv")
    lbl_path = os.path.join(FIXTURES_DIR, "labels.csv")

    df, stats = ingest_zeek(
        conn_log=conn_path,
        ssl_log=ssl_path,
        identity_map_path=id_map,
        labels_path=lbl_path,
    )

    assert len(df) == 6
    assert stats["flow_count"] == 6
    assert stats["labeled"] is True
    assert "user_id" in df.columns
    assert "role" in df.columns
    assert "out_bytes" in df.columns
    assert "sni" in df.columns

    # Identity mapping check
    u101_rows = df[df["user_id"] == "U-101"]
    assert not u101_rows.empty
    assert (u101_rows["role"] == "finance").all()

    # SNI and category join check
    mega_row = df[df["sni"] == "mega.nz"]
    assert not mega_row.empty
    assert mega_row["dest_category"].iloc[0] == "personal_file_sharing"
    assert mega_row["label"].iloc[0] == "exfiltration"


def test_ingest_zeek_json_unlabeled():
    conn_path = os.path.join(FIXTURES_DIR, "conn.json")
    ssl_path = os.path.join(FIXTURES_DIR, "ssl.json")

    df, stats = ingest_zeek(
        conn_log=conn_path,
        ssl_log=ssl_path,
    )

    assert len(df) == 3
    assert stats["labeled"] is False
    assert all(df["label"] == "unlabeled")
    # IPs auto-pseudonymized
    assert all(df["user_id"].str.startswith("U-IP-"))


def test_ingest_flow_csv_fallback():
    with tempfile.TemporaryDirectory() as tmpdir:
        csv_path = os.path.join(tmpdir, "sample_flow.csv")
        sample_df = pd.DataFrame({
            "Timestamp": ["2026-03-01 10:00:00", "2026-03-01 10:05:00"],
            "Source IP": ["10.0.0.5", "10.0.0.6"],
            "Total Length of Fwd Packets": [250000, 450000000],
            "Total Length of Bwd Packets": [12000, 5000],
            "Flow Duration": [15000000, 4200000],  # microseconds
            "Destination Host": ["github.com", "mega.nz"],
            "Label": ["BENIGN", "Web Attack - Exfil"],
        })
        sample_df.to_csv(csv_path, index=False)

        canonical, stats = ingest_flow_csv(csv_path)
        assert len(canonical) == 2
        assert stats["labeled"] is True
        assert canonical["duration"].iloc[0] == 15.0  # Converted from usec to sec
        assert canonical["label"].iloc[1] == "exfiltration"


def test_real_pipeline_execution():
    """Verify that features, baselines, training, scoring, and evaluation run on real ingested data."""
    with tempfile.TemporaryDirectory() as tmpdir:
        conn_path = os.path.join(FIXTURES_DIR, "conn.log")
        ssl_path = os.path.join(FIXTURES_DIR, "ssl.log")
        id_map = os.path.join(FIXTURES_DIR, "identity_map.csv")
        lbl_path = os.path.join(FIXTURES_DIR, "labels.csv")

        df, stats = ingest_zeek(
            conn_log=conn_path,
            ssl_log=ssl_path,
            identity_map_path=id_map,
            labels_path=lbl_path,
        )
        flows_file = os.path.join(tmpdir, "flows.csv")
        df.to_csv(flows_file, index=False)
        write_manifest(
            out_dir=tmpdir,
            dataset_id="test_fixture",
            source_type="zeek_tsv",
            provenance="RFC 5737 Test Fixtures",
            license_str="MIT",
            stats=stats,
        )

        # 1. Features
        feat_15m, feat_24h = features.build_all(flows_path=flows_file, out_dir=tmpdir)
        assert os.path.isfile(os.path.join(tmpdir, "features_15m.csv"))

        # 2. Baselines
        user_bl, peer_bl = baseline.build_and_save(
            feat_path=os.path.join(tmpdir, "features_15m.csv"),
            out_dir=tmpdir,
            assume_benign_history=True,
        )
        assert os.path.isfile(os.path.join(tmpdir, "baselines_user.json"))

        # 3. Training
        model, scaler = train.train(
            feat_path=os.path.join(tmpdir, "features_15m.csv"),
            user_bl_path=os.path.join(tmpdir, "baselines_user.json"),
            model_path=os.path.join(tmpdir, "model.joblib"),
            scaler_path=os.path.join(tmpdir, "scaler.joblib"),
            assume_benign_history=True,
        )
        assert os.path.isfile(os.path.join(tmpdir, "model.joblib"))

        # 4. Scoring
        alerts = score.score_all(data_dir=tmpdir)
        assert os.path.isfile(os.path.join(tmpdir, "alerts.json"))

        # 5. Evaluation
        eval_result = evaluate.run(data_dir=tmpdir)
        assert os.path.isfile(os.path.join(tmpdir, "evaluation.json"))
        assert "results" in eval_result or "operational_telemetry" in eval_result
