import json
import uuid
from datetime import date
from unittest.mock import patch

from app.enums import (
    CompanyType,
    DriveStatus,
    InterventionStatus,
    Priority,
    Result,
    RoundType,
)
from app.models import (
    Coordinator,
    Drive,
    Intervention,
    InterventionAction,
    Mentor,
    MentorStudent,
    Round,
    RoundResult,
    Student,
    StudentDriveRegistration,
)


def _id():
    return str(uuid.uuid4())


def _seed_mentor_data(db):
    coord = Coordinator(coordinator_id="coord-m1", name="Dr. Priya", email="priya@test.edu", department="CSE")
    db.add(coord)

    mentor = Mentor(
        mentor_id="mentor-1", name="Prof. Arun", email="arun@test.edu",
        department="CSE", specialization="DSA", max_mentees=10, current_mentee_count=0,
    )
    db.add(mentor)

    stu1 = Student(
        student_id="stu-m1", name="Rahul Sharma", register_number="2021CS101",
        email="rahul@test.edu", department="CSE", cgpa=7.8,
        tenth_percentage=89.5, twelfth_percentage=85.2,
        placement_marks=72.0, skills=["Python", "SQL"],
    )
    stu2 = Student(
        student_id="stu-m2", name="Sneha Gupta", register_number="2021CS108",
        email="sneha@test.edu", department="CSE", cgpa=9.0,
        tenth_percentage=95.0, twelfth_percentage=93.0,
        placement_marks=92.0, skills=["Java", "Python"],
    )
    db.add_all([stu1, stu2])

    db.add(MentorStudent(id=_id(), mentor_id="mentor-1", student_id="stu-m1"))
    db.add(MentorStudent(id=_id(), mentor_id="mentor-1", student_id="stu-m2"))
    mentor.current_mentee_count = 2

    drive = Drive(
        drive_id="drive-m1", company_name="TCS", company_type=CompanyType.SERVICE,
        role_title="SDE", package_lpa=7.5, drive_date=date(2026, 8, 1),
        required_cgpa=7.0, required_tenth=60.0, required_twelfth=60.0,
        total_rounds=3, drive_status=DriveStatus.COMPLETED,
        coordinator_id="coord-m1",
    )
    db.add(drive)
    db.flush()

    r1 = Round(round_id="r-m1", drive_id="drive-m1", round_type=RoundType.APTITUDE, round_number=1, round_name="Aptitude")
    r2 = Round(round_id="r-m2", drive_id="drive-m1", round_type=RoundType.CODING, round_number=2, round_name="Coding")
    db.add_all([r1, r2])
    db.flush()

    # Rahul: passes aptitude, fails coding
    db.add(RoundResult(result_id=_id(), student_id="stu-m1", round_id="r-m1", drive_id="drive-m1", result=Result.PASSED, score=80, max_score=100, attempt_date=date(2026, 8, 1)))
    db.add(RoundResult(result_id=_id(), student_id="stu-m1", round_id="r-m2", drive_id="drive-m1", result=Result.FAILED, score=30, max_score=100, rejection_reason="Failed DP", weakness_area="Dynamic Programming", attempt_date=date(2026, 8, 1)))
    db.add(StudentDriveRegistration(registration_id=_id(), student_id="stu-m1", drive_id="drive-m1", final_status="REJECTED", rounds_cleared=1))

    drive2 = Drive(
        drive_id="drive-m2", company_name="Zoho", company_type=CompanyType.PRODUCT,
        role_title="MTS", package_lpa=8.0, drive_date=date(2026, 8, 15),
        required_cgpa=7.0, required_tenth=65.0, required_twelfth=65.0,
        total_rounds=3, drive_status=DriveStatus.COMPLETED,
        coordinator_id="coord-m1",
    )
    db.add(drive2)
    db.flush()

    r3 = Round(round_id="r-m3", drive_id="drive-m2", round_type=RoundType.CODING, round_number=1, round_name="Coding")
    db.add(r3)
    db.flush()

    db.add(RoundResult(result_id=_id(), student_id="stu-m1", round_id="r-m3", drive_id="drive-m2", result=Result.FAILED, score=35, max_score=100, rejection_reason="Failed again", weakness_area="Dynamic Programming", attempt_date=date(2026, 8, 15)))
    db.add(StudentDriveRegistration(registration_id=_id(), student_id="stu-m1", drive_id="drive-m2", final_status="REJECTED", rounds_cleared=0))

    # Sneha: placed
    db.add(RoundResult(result_id=_id(), student_id="stu-m2", round_id="r-m1", drive_id="drive-m1", result=Result.PASSED, score=95, max_score=100, attempt_date=date(2026, 8, 1)))
    db.add(RoundResult(result_id=_id(), student_id="stu-m2", round_id="r-m2", drive_id="drive-m1", result=Result.PASSED, score=90, max_score=100, attempt_date=date(2026, 8, 1)))
    db.add(StudentDriveRegistration(registration_id=_id(), student_id="stu-m2", drive_id="drive-m1", final_status="SELECTED", rounds_cleared=3))

    db.commit()
    return mentor, coord, stu1, stu2


def test_get_mentor_profile(client, db):
    mentor, *_ = _seed_mentor_data(db)
    resp = client.get(f"/api/mentor/{mentor.mentor_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Prof. Arun"
    assert data["specialization"] == "DSA"


def test_get_mentor_not_found(client, db):
    resp = client.get(f"/api/mentor/{_id()}")
    assert resp.status_code == 404


def test_get_mentor_dashboard(client, db):
    mentor, *_ = _seed_mentor_data(db)
    resp = client.get(f"/api/mentor/{mentor.mentor_id}/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_mentees"] == 2
    assert data["placed_mentees"] == 1
    assert data["at_risk_mentees"] == 1
    assert data["mentor"]["name"] == "Prof. Arun"


def test_list_mentees(client, db):
    mentor, *_ = _seed_mentor_data(db)
    resp = client.get(f"/api/mentor/{mentor.mentor_id}/students")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    names = {s["name"] for s in data}
    assert "Rahul Sharma" in names
    assert "Sneha Gupta" in names


def test_list_placed_mentees(client, db):
    mentor, *_ = _seed_mentor_data(db)
    resp = client.get(f"/api/mentor/{mentor.mentor_id}/placed-students")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Sneha Gupta"
    assert data[0]["placed_company"] == "TCS"


def test_view_rounds(client, db):
    mentor, _, stu1, _ = _seed_mentor_data(db)
    resp = client.get(f"/api/mentor/{mentor.mentor_id}/students/{stu1.student_id}/rounds")
    assert resp.status_code == 200
    data = resp.json()
    assert data["student_name"] == "Rahul Sharma"
    assert data["total_drives"] == 2
    assert data["rounds_passed"] == 1
    assert data["rounds_failed"] == 2
    assert len(data["rounds"]) == 3


def test_view_rounds_unassigned_student(client, db):
    mentor, *_ = _seed_mentor_data(db)
    unassigned = Student(
        student_id="stu-unassigned", name="Unknown", register_number="9999",
        email="unknown@test.edu", department="CSE", cgpa=7.0,
        tenth_percentage=80.0, twelfth_percentage=75.0,
    )
    db.add(unassigned)
    db.commit()

    resp = client.get(f"/api/mentor/{mentor.mentor_id}/students/stu-unassigned/rounds")
    assert resp.status_code == 403


def test_assign_student(client, db):
    mentor, *_ = _seed_mentor_data(db)
    new_student = Student(
        student_id="stu-new", name="New Student", register_number="2021CS200",
        email="new@test.edu", department="CSE", cgpa=8.0,
        tenth_percentage=88.0, twelfth_percentage=85.0,
    )
    db.add(new_student)
    db.commit()

    resp = client.post(f"/api/mentor/{mentor.mentor_id}/students", json={"student_id": "stu-new"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Student"

    mentor_obj = db.query(Mentor).filter(Mentor.mentor_id == mentor.mentor_id).first()
    assert mentor_obj.current_mentee_count == 3


def test_assign_duplicate_student(client, db):
    mentor, _, stu1, _ = _seed_mentor_data(db)
    resp = client.post(f"/api/mentor/{mentor.mentor_id}/students", json={"student_id": stu1.student_id})
    assert resp.status_code == 409


def test_assign_student_max_capacity(client, db):
    mentor, *_ = _seed_mentor_data(db)
    mentor_obj = db.query(Mentor).filter(Mentor.mentor_id == mentor.mentor_id).first()
    mentor_obj.max_mentees = 2
    db.commit()

    new_student = Student(
        student_id="stu-cap", name="Cap Student", register_number="2021CS300",
        email="cap@test.edu", department="CSE", cgpa=8.0,
        tenth_percentage=88.0, twelfth_percentage=85.0,
    )
    db.add(new_student)
    db.commit()

    resp = client.post(f"/api/mentor/{mentor.mentor_id}/students", json={"student_id": "stu-cap"})
    assert resp.status_code == 400
    assert "capacity" in resp.json()["detail"].lower()


def test_unassign_student(client, db):
    mentor, _, stu1, _ = _seed_mentor_data(db)
    resp = client.delete(f"/api/mentor/{mentor.mentor_id}/students/{stu1.student_id}")
    assert resp.status_code == 200

    mentor_obj = db.query(Mentor).filter(Mentor.mentor_id == mentor.mentor_id).first()
    assert mentor_obj.current_mentee_count == 1


def test_unassign_nonexistent(client, db):
    mentor, *_ = _seed_mentor_data(db)
    resp = client.delete(f"/api/mentor/{mentor.mentor_id}/students/{_id()}")
    assert resp.status_code == 404


MOCK_GROQ_RESPONSE = {
    "analysis": "Student repeatedly fails coding rounds due to weak DP skills.",
    "recommendations": [
        {
            "title": "Practice DP problems",
            "description": "Solve 30 medium DP problems on LeetCode",
            "action_type": "Practice Set",
            "target_weakness": "Dynamic Programming",
            "priority_order": 1,
            "estimated_days": 14,
            "resources": ["https://leetcode.com/tag/dp"],
        }
    ],
}


@patch("app.routers.mentor.generate_intervention")
def test_create_mentor_intervention(mock_gen, client, db):
    mock_gen.return_value = {
        "trigger_reason": "Failed CODING in 2 drives",
        "failure_summary": {"biggest_bottleneck": "CODING"},
        "ai_analysis": "Weak DP skills.",
        "recommendations": MOCK_GROQ_RESPONSE["recommendations"],
        "priority": "HIGH",
    }

    mentor, coord, stu1, _ = _seed_mentor_data(db)
    resp = client.post(
        f"/api/mentor/{mentor.mentor_id}/interventions",
        json={"student_id": stu1.student_id, "coordinator_id": coord.coordinator_id},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["student_id"] == stu1.student_id
    assert data["student_name"] == "Rahul Sharma"
    assert data["priority"] == "HIGH"
    assert data["status"] == "GENERATED"
    assert len(data["actions"]) == 1
    assert data["actions"][0]["title"] == "Practice DP problems"


@patch("app.routers.mentor.generate_intervention")
def test_create_intervention_unassigned_student(mock_gen, client, db):
    mentor, coord, *_ = _seed_mentor_data(db)
    resp = client.post(
        f"/api/mentor/{mentor.mentor_id}/interventions",
        json={"student_id": _id(), "coordinator_id": coord.coordinator_id},
    )
    assert resp.status_code == 403


@patch("app.routers.mentor.generate_intervention")
def test_list_mentor_interventions(mock_gen, client, db):
    mock_gen.return_value = {
        "trigger_reason": "Failed CODING in 2 drives",
        "failure_summary": {"biggest_bottleneck": "CODING"},
        "ai_analysis": "Weak DP skills.",
        "recommendations": MOCK_GROQ_RESPONSE["recommendations"],
        "priority": "HIGH",
    }

    mentor, coord, stu1, _ = _seed_mentor_data(db)
    client.post(
        f"/api/mentor/{mentor.mentor_id}/interventions",
        json={"student_id": stu1.student_id, "coordinator_id": coord.coordinator_id},
    )

    resp = client.get(f"/api/mentor/{mentor.mentor_id}/interventions")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["student_name"] == "Rahul Sharma"


@patch("app.routers.mentor.generate_intervention")
def test_update_action_progress(mock_gen, client, db):
    mock_gen.return_value = {
        "trigger_reason": "Failed CODING in 2 drives",
        "failure_summary": {"biggest_bottleneck": "CODING"},
        "ai_analysis": "Weak DP skills.",
        "recommendations": MOCK_GROQ_RESPONSE["recommendations"],
        "priority": "HIGH",
    }

    mentor, coord, stu1, _ = _seed_mentor_data(db)

    create_resp = client.post(
        f"/api/mentor/{mentor.mentor_id}/interventions",
        json={"student_id": stu1.student_id, "coordinator_id": coord.coordinator_id},
    )
    intv = create_resp.json()

    # Approve the intervention first
    intv_obj = db.query(Intervention).filter(Intervention.intervention_id == intv["intervention_id"]).first()
    intv_obj.status = InterventionStatus.APPROVED
    db.commit()

    action_id = intv["actions"][0]["action_id"]
    resp = client.patch(
        f"/api/mentor/{mentor.mentor_id}/interventions/{intv['intervention_id']}/actions/{action_id}",
        json={"is_completed": True, "notes": "All 30 problems solved"},
    )
    assert resp.status_code == 200
    data = resp.json()
    updated_action = [a for a in data["actions"] if a["action_id"] == action_id][0]
    assert updated_action["is_completed"] is True
    assert updated_action["notes"] == "All 30 problems solved"
    assert data["status"] == "COMPLETED"


@patch("app.routers.mentor.generate_intervention")
def test_update_action_moves_to_in_progress(mock_gen, client, db):
    mock_gen.return_value = {
        "trigger_reason": "Failed CODING",
        "failure_summary": {"biggest_bottleneck": "CODING"},
        "ai_analysis": "Weak DP.",
        "recommendations": [
            {"title": "Task 1", "description": "Desc 1", "action_type": "Practice", "target_weakness": "DP"},
            {"title": "Task 2", "description": "Desc 2", "action_type": "Mock", "target_weakness": "DP"},
        ],
        "priority": "HIGH",
    }

    mentor, coord, stu1, _ = _seed_mentor_data(db)
    create_resp = client.post(
        f"/api/mentor/{mentor.mentor_id}/interventions",
        json={"student_id": stu1.student_id, "coordinator_id": coord.coordinator_id},
    )
    intv = create_resp.json()

    intv_obj = db.query(Intervention).filter(Intervention.intervention_id == intv["intervention_id"]).first()
    intv_obj.status = InterventionStatus.APPROVED
    db.commit()

    action_id = intv["actions"][0]["action_id"]
    resp = client.patch(
        f"/api/mentor/{mentor.mentor_id}/interventions/{intv['intervention_id']}/actions/{action_id}",
        json={"is_completed": True, "notes": "Done"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "IN_PROGRESS"
