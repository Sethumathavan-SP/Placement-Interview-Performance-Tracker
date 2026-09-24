from datetime import date

from app.models import (
    Student, Coordinator, Mentor, Drive, Round, RoundResult, StudentDriveRegistration,
)


def _seed_department_data(db):
    coordinator = Coordinator(
        coordinator_id="coord-1", name="Dr. Kumar", email="kumar@test.com", department="CSE"
    )
    db.add(coordinator)

    s1 = Student(
        student_id="stu-1", name="Sneha Gupta", register_number="2021CS001",
        email="sneha@test.com", department="CSE", cgpa=8.5,
        tenth_percentage=90.0, twelfth_percentage=85.0,
    )
    s2 = Student(
        student_id="stu-2", name="Rahul Verma", register_number="2021CS002",
        email="rahul@test.com", department="CSE", cgpa=7.2,
        tenth_percentage=80.0, twelfth_percentage=75.0,
    )
    s3 = Student(
        student_id="stu-3", name="Priya Shah", register_number="2021EC001",
        email="priya@test.com", department="ECE", cgpa=9.0,
        tenth_percentage=95.0, twelfth_percentage=90.0,
    )
    db.add_all([s1, s2, s3])

    m1 = Mentor(
        mentor_id="men-1", name="Prof. Rajan", email="rajan@test.com",
        department="CSE", specialization="Data Structures",
    )
    m2 = Mentor(
        mentor_id="men-2", name="Prof. Nair", email="nair@test.com",
        department="ECE", specialization="VLSI",
    )
    db.add_all([m1, m2])

    drive = Drive(
        drive_id="drive-1", company_name="Zoho", company_type="PRODUCT",
        role_title="SDE", package_lpa=8.0, drive_date=date(2026, 9, 15),
        required_cgpa=7.0, required_tenth=60.0, required_twelfth=60.0,
        total_rounds=3, coordinator_id="coord-1",
    )
    db.add(drive)

    r1 = Round(round_id="r1", drive_id="drive-1", round_type="APTITUDE", round_number=1, round_name="Aptitude Test")
    r2 = Round(round_id="r2", drive_id="drive-1", round_type="CODING", round_number=2, round_name="Coding Round")
    db.add_all([r1, r2])

    res1 = RoundResult(
        result_id="res-1", student_id="stu-1", round_id="r1", drive_id="drive-1",
        result="PASSED", score=85, max_score=100, attempt_date=date(2026, 9, 15),
    )
    res2 = RoundResult(
        result_id="res-2", student_id="stu-1", round_id="r2", drive_id="drive-1",
        result="FAILED", score=30, max_score=100, weakness_area="Data Structures",
        attempt_date=date(2026, 9, 15),
    )
    res3 = RoundResult(
        result_id="res-3", student_id="stu-2", round_id="r1", drive_id="drive-1",
        result="FAILED", score=40, max_score=100, weakness_area="Logical Reasoning",
        attempt_date=date(2026, 9, 15),
    )
    res4 = RoundResult(
        result_id="res-4", student_id="stu-3", round_id="r1", drive_id="drive-1",
        result="PASSED", score=90, max_score=100, attempt_date=date(2026, 9, 15),
    )
    res5 = RoundResult(
        result_id="res-5", student_id="stu-3", round_id="r2", drive_id="drive-1",
        result="PASSED", score=80, max_score=100, attempt_date=date(2026, 9, 15),
    )
    db.add_all([res1, res2, res3, res4, res5])

    reg1 = StudentDriveRegistration(
        registration_id="reg-1", student_id="stu-1", drive_id="drive-1",
        final_status="REJECTED", rounds_cleared=1,
    )
    reg2 = StudentDriveRegistration(
        registration_id="reg-2", student_id="stu-2", drive_id="drive-1",
        final_status="REJECTED", rounds_cleared=0,
    )
    reg3 = StudentDriveRegistration(
        registration_id="reg-3", student_id="stu-3", drive_id="drive-1",
        final_status="SELECTED", rounds_cleared=2,
    )
    db.add_all([reg1, reg2, reg3])
    db.commit()


def test_list_departments(client, db):
    _seed_department_data(db)
    resp = client.get("/api/department/list")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    depts = {d["department"]: d for d in data}
    assert depts["CSE"]["total_students"] == 2
    assert depts["CSE"]["total_mentors"] == 1
    assert depts["ECE"]["total_students"] == 1
    assert depts["ECE"]["placed_students"] == 1


def test_get_department_students(client, db):
    _seed_department_data(db)
    resp = client.get("/api/department/CSE/students")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    names = [s["name"] for s in data]
    assert "Sneha Gupta" in names
    assert "Rahul Verma" in names


def test_get_department_students_not_found(client, db):
    resp = client.get("/api/department/FAKE/students")
    assert resp.status_code == 404


def test_get_department_mentors(client, db):
    _seed_department_data(db)
    resp = client.get("/api/department/CSE/mentors")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Prof. Rajan"
    assert data[0]["specialization"] == "Data Structures"


def test_view_rounds(client, db):
    _seed_department_data(db)
    resp = client.get("/api/department/CSE/rounds")
    assert resp.status_code == 200
    data = resp.json()
    assert data["department"] == "CSE"
    assert data["total_drives"] == 1
    assert len(data["rounds"]) == 2
    aptitude = [r for r in data["rounds"] if r["round_type"] == "APTITUDE"][0]
    assert aptitude["total_appeared"] == 2
    assert aptitude["total_passed"] == 1
    assert aptitude["total_failed"] == 1


def test_view_failure_pattern(client, db):
    _seed_department_data(db)
    resp = client.get("/api/department/CSE/failure-pattern")
    assert resp.status_code == 200
    data = resp.json()
    assert data["department"] == "CSE"
    assert data["total_students"] == 2
    assert data["total_failures"] == 2
    types = {f["round_type"]: f for f in data["failure_by_round_type"]}
    assert "APTITUDE" in types
    assert "CODING" in types


def test_department_wise_analysis(client, db):
    _seed_department_data(db)
    resp = client.get("/api/department/analysis")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_departments"] == 2
    depts = {d["department"]: d for d in data["departments"]}
    assert depts["CSE"]["total_students"] == 2
    assert depts["CSE"]["total_failures"] == 2
    assert depts["ECE"]["placed_students"] == 1
    assert depts["ECE"]["placement_rate"] == 100.0
    assert depts["ECE"]["total_failures"] == 0


def test_view_rounds_ece(client, db):
    _seed_department_data(db)
    resp = client.get("/api/department/ECE/rounds")
    assert resp.status_code == 200
    data = resp.json()
    assert data["department"] == "ECE"
    assert data["total_drives"] == 1
    aptitude = [r for r in data["rounds"] if r["round_type"] == "APTITUDE"][0]
    assert aptitude["total_passed"] == 1
    assert aptitude["total_failed"] == 0


def test_view_overall_pattern(client, db):
    _seed_department_data(db)
    resp = client.get("/api/department/overall-pattern")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_students"] == 3
    assert data["total_departments"] == 2
    assert data["total_failures"] == 2
    types = {f["round_type"]: f for f in data["failure_by_round_type"]}
    assert "APTITUDE" in types
    assert "CODING" in types

