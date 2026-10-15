"""Contract checks for deterministic replay over prepared artifacts."""
import pytest
from fastapi import HTTPException

from api import main


@pytest.fixture(scope="module", autouse=True)
def prepared_artifacts():
    main.load_artifacts()
    assert main.state["load_error"] is None


def test_scenario_mappings_are_owned_by_generator():
    assert main.SCENARIO_USERS == {
        "S1": "U-000", "S2": "U-008", "S3": "U-019",
        "S4": "U-009", "S5": "U-024", "S6": "U-002",
    }


@pytest.mark.parametrize("scenario,entity", [("S1", "U-000"), ("S2", "U-008"), ("S3", "U-019")])
def test_replay_uses_prepared_windows_without_generating(scenario, entity, monkeypatch):
    from ml import generate
    monkeypatch.setattr(generate, "main", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("dataset generation called")))
    result = main.scenario_replay(scenario)
    assert result["entity"] == entity
    assert result["events"]
    assert all(event["scenario_id"] == scenario for event in result["events"])
    assert all("cum_out_7d" in event and "alerts" in event for event in result["events"])
    if scenario in {"S2", "S3"}:
        alert = next(alert for event in result["events"] for alert in event["alerts"])
        assert {"risk", "severity", "signals", "destination", "recommended_action"} <= alert.keys()


@pytest.mark.parametrize("scenario,entity,role", [
    ("S1", "U-000", "engineer"), ("S2", "U-008", "finance"),
    ("S3", "U-019", "hr"), ("S4", "U-009", "finance"),
    ("S5", "U-024", "sales"), ("S6", "U-002", "engineer"),
])
def test_all_scenarios_return_their_tagged_events(scenario, entity, role):
    result = main.scenario_replay(scenario)
    assert (result["entity"], result["role"]) == (entity, role)
    assert result["events"]
    assert all(event["scenario_id"] == scenario for event in result["events"])


def test_missing_artifact_error_is_actionable(monkeypatch):
    original = main.state["load_error"]
    monkeypatch.setitem(main.state, "load_error", "Missing prepared artifacts. Run `python run_pipeline.py`.")
    with pytest.raises(HTTPException, match="run_pipeline.py"):
        main._require_loaded()
    main.state["load_error"] = original
