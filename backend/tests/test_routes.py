import uuid
from datetime import date
from unittest.mock import patch

from app.enums import CompanyType, DriveStatus, Result, RoundType
from app.models import (
    Coordinator, Drive, Round, RoundResult, Student,
    StudentDriveRegistration,
)


def _id():
    return str(uuid.uuid4())


def _seed_test_data(db):
    coord = Coordinator(coordinator_id=_id(), name="Admin", email="admin@test.edu")
    db.add(coord)

    student = Student(
        student_id=_id(), name="Test Student", register_number="TEST001",
        email="test@test.edu", department="CSE", cgpa=7.5,
        tenth_percentage=85.0, twelfth_percentage=80.0,
        placement_marks=70.0, skills=["Python"],
    )
    db.add(student)
    db.flush()

    drive = Drive(
        drive_id=_id(), company_name="TestCorp", company_type=CompanyType.SERVICE,
        role_title="SDE", package_lpa=6.0, drive_date=date(2026, 8, 1),
        required_cgpa=7.0, required_tenth=60.0, required_twelfth=60.0,
        total_rounds=3, drive_status=DriveStatus.COMPLETED,
        coordinator_id=coord.coordinator_id,
    )
    db.add(drive)
    db.flush()

    r1 = Round(round_id=_id(), drive_id=drive.drive_id, round_type=RoundType.APTITUDE, round_number=1, round_name="Aptitude", total_appeared=50, total_passed=30)
    r2 = Round(round_id=_id(), drive_id=drive.drive_id, round_type=RoundType.CODING, round_number=2, round_name="Coding", total_appeared=30, total_passed=10)
    db.add_all([r1, r2])
    db.flush()

    db.add(RoundResult(result_id=_id(), student_id=student.student_id, round_id=r1.round_id, drive_id=drive.drive_id, result=Result.PASSED, score=80, max_score=100, attempt_date=date(2026, 8, 1)))
    db.add(RoundResult(result_id=_id(), student_id=student.student_id, round_id=r2.round_id, drive_id=drive.drive_id, result=Result.FAILED, score=30, max_score=100, rejection_reason="Failed DP", weakness_area="Dynamic Programming", attempt_date=date(2026, 8, 1)))
    db.add(StudentDriveRegistration(registration_id=_id(), student_id=student.student_id, drive_id=drive.drive_id, final_status="REJECTED", rounds_cleared=1))

    drive2 = Drive(
        drive_id=_id(), company_name="TestCorp2", company_type=CompanyType.PRODUCT,
        role_title="SDE", package_lpa=8.0, drive_date=date(2026, 8, 15),
        required_cgpa=7.0, required_tenth=60.0, required_twelfth=60.0,
        total_rounds=3, drive_status=DriveStatus.COMPLETED,
        coordinator_id=coord.coordinator_id,
    )
    db.add(drive2)
    db.flush()

    r3 = Round(round_id=_id(), drive_id=drive2.drive_id, round_type=RoundType.CODING, round_number=1, round_name="Coding", total_appeared=40, total_passed=12)
    db.add(r3)
    db.flush()

    db.add(RoundResult(result_id=_id(), student_id=student.student_id, round_id=r3.round_id, drive_id=drive2.drive_id, result=Result.FAILED, score=35, max_score=100, rejection_reason="Failed again", weakness_area="Dynamic Programming", attempt_date=date(2026, 8, 15)))
    db.add(StudentDriveRegistration(registration_id=_id(), student_id=student.student_id, drive_id=drive2.drive_id, final_status="REJECTED", rounds_cleared=0))

    db.commit()
    return student, coord


def test_get_at_risk_students(client, db):
    student, coord = _seed_test_data(db)
    resp = client.get("/api/intervention/at-risk?min_failures=2")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert any(s["student_id"] == student.student_id for s in data)


def test_get_student_pattern(client, db):
    student, coord = _seed_test_data(db)
    resp = client.get(f"/api/intervention/pattern/{student.student_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["student_name"] == "Test Student"
    assert "CODING" in data["failure_by_round_type"]


def test_get_student_pattern_not_found(client):
    resp = client.get(f"/api/intervention/pattern/{_id()}")
    assert resp.status_code == 404


def test_failure_analysis_overview_is_registered(client, db):
    _, coord = _seed_test_data(db)

    resp = client.get(
        "/coordinator/analysis/overview",
        headers={
            "X-User-Id": coord.coordinator_id,
            "X-User-Role": "placement_coordinator",
        },
    )

    assert resp.status_code == 200
    assert resp.json()["total_students"] == 1
    assert resp.json()["students_with_repeated_failures"] == 1


MOCK_GROQ_RESPONSE = {
    "analysis": "Student consistently fails coding rounds due to weak DP skills.",
    "recommendations": [
        {
            "title": "Practice DP problems",
            "description": "Solve 30 medium DP problems",
            "action_type": "Practice Set",
            "target_weakness": "Dynamic Programming",
            "priority_order": 1,
            "estimated_days": 14,
            "resources": ["https://leetcode.com/tag/dp"],
        }
    ],
}


@patch("app.services.groq_agent.Groq")
def test_create_intervention(mock_groq_cls, client, db):
    import json
    mock_client = mock_groq_cls.return_value
    mock_response = type("R", (), {
        "choices": [type("C", (), {
            "message": type("M", (), {"content": json.dumps(MOCK_GROQ_RESPONSE)})()
        })()]
    })()
    mock_client.chat.completions.create.return_value = mock_response

    student, coord = _seed_test_data(db)
    resp = client.post(
        f"/api/intervention/{student.student_id}",
        json={"student_id": student.student_id, "coordinator_id": coord.coordinator_id},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["student_id"] == student.student_id
    assert data["priority"] in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    assert data["status"] == "GENERATED"
    assert len(data["actions"]) >= 1
    return data["intervention_id"]


@patch("app.services.groq_agent.Groq")
def test_update_intervention_status(mock_groq_cls, client, db):
    import json
    mock_client = mock_groq_cls.return_value
    mock_response = type("R", (), {
        "choices": [type("C", (), {
            "message": type("M", (), {"content": json.dumps(MOCK_GROQ_RESPONSE)})()
        })()]
    })()
    mock_client.chat.completions.create.return_value = mock_response

    student, coord = _seed_test_data(db)
    create_resp = client.post(
        f"/api/intervention/{student.student_id}",
        json={"student_id": student.student_id, "coordinator_id": coord.coordinator_id},
    )
    intv_id = create_resp.json()["intervention_id"]

    resp = client.patch(
        f"/api/intervention/{intv_id}/status",
        json={"status": "APPROVED"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "APPROVED"
    assert resp.json()["approved_at"] is not None


@patch("app.services.groq_agent.Groq")
def test_list_interventions(mock_groq_cls, client, db):
    import json
    mock_client = mock_groq_cls.return_value
    mock_response = type("R", (), {
        "choices": [type("C", (), {
            "message": type("M", (), {"content": json.dumps(MOCK_GROQ_RESPONSE)})()
        })()]
    })()
    mock_client.chat.completions.create.return_value = mock_response

    student, coord = _seed_test_data(db)
    client.post(
        f"/api/intervention/{student.student_id}",
        json={"student_id": student.student_id, "coordinator_id": coord.coordinator_id},
    )

    resp = client.get("/api/intervention/")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@patch("app.services.groq_agent.Groq")
def test_update_action_status(mock_groq_cls, client, db):
    import json
    mock_client = mock_groq_cls.return_value
    mock_response = type("R", (), {
        "choices": [type("C", (), {
            "message": type("M", (), {"content": json.dumps(MOCK_GROQ_RESPONSE)})()
        })()]
    })()
    mock_client.chat.completions.create.return_value = mock_response

    student, coord = _seed_test_data(db)
    create_resp = client.post(
        f"/api/intervention/{student.student_id}",
        json={"student_id": student.student_id, "coordinator_id": coord.coordinator_id},
    )
    data = create_resp.json()
    intv_id = data["intervention_id"]
    action_id = data["actions"][0]["action_id"]

    resp = client.patch(
        f"/api/intervention/{intv_id}/actions/{action_id}",
        json={"is_completed": True, "notes": "Completed all exercises"},
    )
    assert resp.status_code == 200
    updated_data = resp.json()
    updated_action = [a for a in updated_data["actions"] if a["action_id"] == action_id][0]
    assert updated_action["is_completed"] is True
    assert updated_action["completed_at"] is not None
    assert updated_action["notes"] == "Completed all exercises"
