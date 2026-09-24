import uuid
from datetime import date, datetime

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
    MentorNote,
    MentorStudent,
    Round,
    RoundResult,
    Student,
    StudentDriveRegistration,
)


def _id():
    return str(uuid.uuid4())


def _seed(db):
    coord = Coordinator(coordinator_id="coord-f1", name="Dr. Priya", email="priya@f.edu", department="CSE")
    db.add(coord)

    mentor = Mentor(
        mentor_id="mentor-f1", name="Prof. Arun", email="arun@f.edu",
        department="CSE", specialization="DSA", max_mentees=10, current_mentee_count=0,
    )
    db.add(mentor)

    stu1 = Student(
        student_id="stu-f1", name="Rahul Sharma", register_number="2021CS101",
        email="rahul@f.edu", department="CSE", cgpa=7.8,
        tenth_percentage=89.5, twelfth_percentage=85.2,
        placement_marks=72.0, skills=["Python", "SQL"],
    )
    stu2 = Student(
        student_id="stu-f2", name="Sneha Gupta", register_number="2021CS108",
        email="sneha@f.edu", department="CSE", cgpa=9.0,
        tenth_percentage=95.0, twelfth_percentage=93.0,
        placement_marks=92.0, skills=["Java", "Python"],
    )
    db.add_all([stu1, stu2])

    db.add(MentorStudent(id=_id(), mentor_id="mentor-f1", student_id="stu-f1"))
    db.add(MentorStudent(id=_id(), mentor_id="mentor-f1", student_id="stu-f2"))
    mentor.current_mentee_count = 2

    drive = Drive(
        drive_id="drive-f1", company_name="TCS", company_type=CompanyType.SERVICE,
        role_title="SDE", package_lpa=7.5, drive_date=date(2026, 8, 1),
        required_cgpa=7.0, required_tenth=60.0, required_twelfth=60.0,
        total_rounds=3, drive_status=DriveStatus.COMPLETED,
        coordinator_id="coord-f1",
    )
    db.add(drive)
    db.flush()

    r1 = Round(round_id="r-f1", drive_id="drive-f1", round_type=RoundType.APTITUDE, round_number=1, round_name="Aptitude")
    r2 = Round(round_id="r-f2", drive_id="drive-f1", round_type=RoundType.CODING, round_number=2, round_name="Coding")
    db.add_all([r1, r2])
    db.flush()

    db.add(RoundResult(result_id=_id(), student_id="stu-f1", round_id="r-f1", drive_id="drive-f1", result=Result.PASSED, score=80, max_score=100, attempt_date=date(2026, 8, 1)))
    db.add(RoundResult(result_id=_id(), student_id="stu-f1", round_id="r-f2", drive_id="drive-f1", result=Result.FAILED, score=30, max_score=100, rejection_reason="Failed DP", weakness_area="Dynamic Programming", attempt_date=date(2026, 8, 1)))
    db.add(StudentDriveRegistration(registration_id=_id(), student_id="stu-f1", drive_id="drive-f1", final_status="REJECTED", rounds_cleared=1))

    db.add(RoundResult(result_id=_id(), student_id="stu-f2", round_id="r-f1", drive_id="drive-f1", result=Result.PASSED, score=95, max_score=100, attempt_date=date(2026, 8, 1)))
    db.add(RoundResult(result_id=_id(), student_id="stu-f2", round_id="r-f2", drive_id="drive-f1", result=Result.PASSED, score=90, max_score=100, attempt_date=date(2026, 8, 1)))
    db.add(StudentDriveRegistration(registration_id=_id(), student_id="stu-f2", drive_id="drive-f1", final_status="SELECTED", rounds_cleared=3))

    db.commit()
    return mentor, coord, stu1, stu2


# ── Notes ──────────────────────────────────────────────────────────


def test_create_note(client, db):
    mentor, _, stu1, _ = _seed(db)
    resp = client.post(
        f"/api/mentor/{mentor.mentor_id}/students/{stu1.student_id}/notes",
        json={"content": "Needs more practice on DP."},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["content"] == "Needs more practice on DP."
    assert data["mentor_id"] == mentor.mentor_id
    assert data["student_id"] == stu1.student_id
    assert data["note_id"] is not None


def test_list_notes(client, db):
    mentor, _, stu1, _ = _seed(db)
    client.post(
        f"/api/mentor/{mentor.mentor_id}/students/{stu1.student_id}/notes",
        json={"content": "Note 1"},
    )
    client.post(
        f"/api/mentor/{mentor.mentor_id}/students/{stu1.student_id}/notes",
        json={"content": "Note 2"},
    )
    resp = client.get(f"/api/mentor/{mentor.mentor_id}/students/{stu1.student_id}/notes")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["content"] == "Note 2"
    assert data[1]["content"] == "Note 1"


def test_update_note(client, db):
    mentor, _, stu1, _ = _seed(db)
    create_resp = client.post(
        f"/api/mentor/{mentor.mentor_id}/students/{stu1.student_id}/notes",
        json={"content": "Original note"},
    )
    note_id = create_resp.json()["note_id"]

    resp = client.patch(
        f"/api/mentor/{mentor.mentor_id}/notes/{note_id}",
        json={"content": "Updated note"},
    )
    assert resp.status_code == 200
    assert resp.json()["content"] == "Updated note"


def test_delete_note(client, db):
    mentor, _, stu1, _ = _seed(db)
    create_resp = client.post(
        f"/api/mentor/{mentor.mentor_id}/students/{stu1.student_id}/notes",
        json={"content": "To delete"},
    )
    note_id = create_resp.json()["note_id"]

    resp = client.delete(f"/api/mentor/{mentor.mentor_id}/notes/{note_id}")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Note deleted"

    list_resp = client.get(f"/api/mentor/{mentor.mentor_id}/students/{stu1.student_id}/notes")
    assert len(list_resp.json()) == 0


def test_note_unassigned_student(client, db):
    mentor, *_ = _seed(db)
    unassigned = Student(
        student_id="stu-unassigned", name="Unknown", register_number="9999",
        email="unknown@f.edu", department="CSE", cgpa=7.0,
        tenth_percentage=80.0, twelfth_percentage=75.0,
    )
    db.add(unassigned)
    db.commit()

    resp = client.post(
        f"/api/mentor/{mentor.mentor_id}/students/stu-unassigned/notes",
        json={"content": "Should fail"},
    )
    assert resp.status_code == 403


# ── Metrics ────────────────────────────────────────────────────────


def test_metrics_no_interventions(client, db):
    mentor, *_ = _seed(db)
    resp = client.get(f"/api/mentor/{mentor.mentor_id}/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_interventions"] == 0
    assert data["completed_interventions"] == 0
    assert data["intervention_completion_rate"] == 0.0
    assert data["total_actions"] == 0
    assert data["mentees_improved"] == 0
    assert data["mentees_tracked"] == 0


def test_metrics_with_intervention(client, db):
    mentor, coord, stu1, _ = _seed(db)

    intv = Intervention(
        intervention_id=_id(),
        student_id=stu1.student_id,
        coordinator_id=coord.coordinator_id,
        mentor_id=mentor.mentor_id,
        trigger_reason="Failed coding",
        failure_summary={"biggest_bottleneck": "CODING"},
        ai_analysis="Weak DP.",
        recommendations=[],
        priority=Priority.HIGH,
        status=InterventionStatus.COMPLETED,
        completed_at=datetime.utcnow(),
    )
    db.add(intv)
    db.flush()

    action = InterventionAction(
        action_id=_id(),
        intervention_id=intv.intervention_id,
        action_type="Practice",
        title="DP problems",
        description="Solve 30 problems",
        target_weakness="DP",
        is_completed=True,
        completed_at=datetime.utcnow(),
    )
    db.add(action)
    db.commit()

    resp = client.get(f"/api/mentor/{mentor.mentor_id}/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_interventions"] == 1
    assert data["completed_interventions"] == 1
    assert data["intervention_completion_rate"] == 100.0
    assert data["total_actions"] == 1
    assert data["completed_actions"] == 1
    assert data["action_completion_rate"] == 100.0
    assert data["mentees_tracked"] == 1
    assert len(data["mentee_details"]) == 1
    detail = data["mentee_details"][0]
    assert detail["student_name"] == "Rahul Sharma"


# ── Student Detail ─────────────────────────────────────────────────


def test_student_detail(client, db):
    mentor, _, stu1, _ = _seed(db)

    client.post(
        f"/api/mentor/{mentor.mentor_id}/students/{stu1.student_id}/notes",
        json={"content": "Good progress"},
    )

    resp = client.get(f"/api/mentor/{mentor.mentor_id}/students/{stu1.student_id}/detail")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Rahul Sharma"
    assert data["cgpa"] == 7.8
    assert data["tenth_percentage"] == 89.5
    assert data["twelfth_percentage"] == 85.2
    assert len(data["rounds"]) == 2
    assert len(data["applications"]) == 1
    assert data["applications"][0]["company_name"] == "TCS"
    assert data["applications"][0]["final_status"] == "REJECTED"
    assert len(data["notes"]) == 1
    assert data["notes"][0]["content"] == "Good progress"


def test_student_detail_unassigned(client, db):
    mentor, *_ = _seed(db)
    unassigned = Student(
        student_id="stu-x", name="X", register_number="0000",
        email="x@f.edu", department="CSE", cgpa=7.0,
        tenth_percentage=80.0, twelfth_percentage=75.0,
    )
    db.add(unassigned)
    db.commit()

    resp = client.get(f"/api/mentor/{mentor.mentor_id}/students/stu-x/detail")
    assert resp.status_code == 403
