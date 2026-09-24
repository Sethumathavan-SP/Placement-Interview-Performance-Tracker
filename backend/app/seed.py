import uuid
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.enums import CompanyType, DriveStatus, Result, RoundType
from app.models import (
    Student, Coordinator, Mentor, MentorStudent, Drive, Round,
    RoundResult, StudentDriveRegistration,
)


def _id():
    return str(uuid.uuid4())


def seed_database(db: Session) -> None:
    if db.query(Student).count() > 0:
        print("Database already seeded, skipping.")
        return

    # --- Coordinator (fixed ID for frontend) ---
    coord = Coordinator(
        coordinator_id="coord-001",
        name="Dr. Priya Kumar",
        email="priya@college.edu",
        department="CSE",
    )
    db.add(coord)

    # --- Mentors (fixed IDs for frontend) ---
    mentor_dsa = Mentor(
        mentor_id="mentor-dsa-001", name="Prof. Arun Raj", email="arun@college.edu",
        department="CSE", specialization="Data Structures & Algorithms",
        max_mentees=10, current_mentee_count=3,
    )
    mentor_sys = Mentor(
        mentor_id="mentor-sys-001", name="Prof. Meena Iyer", email="meena@college.edu",
        department="CSE", specialization="System Design & OOPS",
        max_mentees=8, current_mentee_count=2,
    )
    mentor_soft = Mentor(
        mentor_id="mentor-soft-001", name="Prof. Karthik Nair", email="karthik@college.edu",
        department="CSE", specialization="Communication & Soft Skills",
        max_mentees=12, current_mentee_count=5,
    )
    db.add_all([mentor_dsa, mentor_sys, mentor_soft])

    # --- Students ---
    students = [
        Student(
            student_id=_id(), name="Rahul Sharma", register_number="2021CS101",
            email="rahul@college.edu", department="CSE", cgpa=7.8,
            tenth_percentage=89.5, twelfth_percentage=85.2,
            placement_marks=72.0, skills=["Python", "SQL", "Java"],
        ),
        Student(
            student_id=_id(), name="Ananya Reddy", register_number="2021CS102",
            email="ananya@college.edu", department="CSE", cgpa=8.5,
            tenth_percentage=92.0, twelfth_percentage=88.0,
            placement_marks=85.0, skills=["Java", "Spring Boot", "React"],
        ),
        Student(
            student_id=_id(), name="Vikram Patel", register_number="2021IT103",
            email="vikram@college.edu", department="IT", cgpa=6.9,
            tenth_percentage=78.0, twelfth_percentage=72.0,
            placement_marks=55.0, skills=["Python", "HTML", "CSS"],
        ),
        Student(
            student_id=_id(), name="Deepa Krishnan", register_number="2021CS104",
            email="deepa@college.edu", department="CSE", cgpa=7.2,
            tenth_percentage=85.0, twelfth_percentage=80.0,
            placement_marks=60.0, skills=["C++", "Python"],
        ),
        Student(
            student_id=_id(), name="Arjun Menon", register_number="2021ECE105",
            email="arjun@college.edu", department="ECE", cgpa=7.5,
            tenth_percentage=88.0, twelfth_percentage=82.0,
            placement_marks=65.0, skills=["C", "Embedded", "Python"],
        ),
        Student(
            student_id=_id(), name="Priya Nair", register_number="2021CS106",
            email="priyan@college.edu", department="CSE", cgpa=8.1,
            tenth_percentage=90.0, twelfth_percentage=87.0,
            placement_marks=78.0, skills=["Java", "Python", "ML"],
        ),
        Student(
            student_id=_id(), name="Kiran Das", register_number="2021IT107",
            email="kiran@college.edu", department="IT", cgpa=6.5,
            tenth_percentage=75.0, twelfth_percentage=70.0,
            placement_marks=50.0, skills=["Python"],
        ),
        Student(
            student_id=_id(), name="Sneha Gupta", register_number="2021CS108",
            email="sneha@college.edu", department="CSE", cgpa=9.0,
            tenth_percentage=95.0, twelfth_percentage=93.0,
            placement_marks=92.0, skills=["Java", "Python", "DS", "System Design"],
        ),
        Student(
            student_id=_id(), name="Manoj Kumar", register_number="2021ECE109",
            email="manoj@college.edu", department="ECE", cgpa=7.0,
            tenth_percentage=80.0, twelfth_percentage=76.0,
            placement_marks=58.0, skills=["C", "Python", "MATLAB"],
        ),
        Student(
            student_id=_id(), name="Divya Rajan", register_number="2021CS110",
            email="divya@college.edu", department="CSE", cgpa=7.6,
            tenth_percentage=86.0, twelfth_percentage=83.0,
            placement_marks=70.0, skills=["Python", "Django", "SQL"],
        ),
    ]
    db.add_all(students)
    db.flush()

    # --- Drives ---
    drive_tcs = Drive(
        drive_id=_id(), company_name="TCS", company_type=CompanyType.SERVICE,
        role_title="Software Developer", package_lpa=7.5,
        drive_date=date(2026, 7, 15), required_cgpa=7.0,
        required_tenth=60.0, required_twelfth=60.0,
        total_rounds=4, drive_status=DriveStatus.COMPLETED,
        coordinator_id=coord.coordinator_id,
    )
    drive_infosys = Drive(
        drive_id=_id(), company_name="Infosys", company_type=CompanyType.SERVICE,
        role_title="Systems Engineer", package_lpa=5.0,
        drive_date=date(2026, 8, 1), required_cgpa=6.5,
        required_tenth=60.0, required_twelfth=60.0,
        total_rounds=4, drive_status=DriveStatus.COMPLETED,
        coordinator_id=coord.coordinator_id,
    )
    drive_zoho = Drive(
        drive_id=_id(), company_name="Zoho", company_type=CompanyType.PRODUCT,
        role_title="Member Technical Staff", package_lpa=8.0,
        drive_date=date(2026, 8, 20), required_cgpa=7.0,
        required_tenth=65.0, required_twelfth=65.0,
        total_rounds=5, drive_status=DriveStatus.COMPLETED,
        coordinator_id=coord.coordinator_id,
    )
    db.add_all([drive_tcs, drive_infosys, drive_zoho])
    db.flush()

    # --- Rounds for each drive ---
    tcs_rounds = [
        Round(round_id=_id(), drive_id=drive_tcs.drive_id, round_type=RoundType.APTITUDE, round_number=1, round_name="Online Aptitude", description="Quant, Logical, Verbal - 80 questions 90 min", total_appeared=85, total_passed=40),
        Round(round_id=_id(), drive_id=drive_tcs.drive_id, round_type=RoundType.CODING, round_number=2, round_name="Coding Round", description="2 DSA problems, 1 SQL query, 45 min", total_appeared=40, total_passed=15),
        Round(round_id=_id(), drive_id=drive_tcs.drive_id, round_type=RoundType.TECHNICAL, round_number=3, round_name="Technical Interview", description="DS, Algo, OOPS, DBMS, OS concepts", total_appeared=15, total_passed=8),
        Round(round_id=_id(), drive_id=drive_tcs.drive_id, round_type=RoundType.HR, round_number=4, round_name="HR Interview", description="Behavioral questions, salary discussion", total_appeared=8, total_passed=6),
    ]
    infy_rounds = [
        Round(round_id=_id(), drive_id=drive_infosys.drive_id, round_type=RoundType.APTITUDE, round_number=1, round_name="InfyTQ Test", description="Quant, Logical, Verbal - 65 questions 75 min", total_appeared=90, total_passed=50),
        Round(round_id=_id(), drive_id=drive_infosys.drive_id, round_type=RoundType.CODING, round_number=2, round_name="Coding Round", description="3 problems - array, string, DP", total_appeared=50, total_passed=20),
        Round(round_id=_id(), drive_id=drive_infosys.drive_id, round_type=RoundType.TECHNICAL, round_number=3, round_name="Technical Interview", description="Project discussion, CS fundamentals", total_appeared=20, total_passed=12),
        Round(round_id=_id(), drive_id=drive_infosys.drive_id, round_type=RoundType.HR, round_number=4, round_name="HR Interview", description="Fitment and behavioral", total_appeared=12, total_passed=10),
    ]
    zoho_rounds = [
        Round(round_id=_id(), drive_id=drive_zoho.drive_id, round_type=RoundType.APTITUDE, round_number=1, round_name="Aptitude Test", description="Advanced quant and logical, 60 min", total_appeared=70, total_passed=30),
        Round(round_id=_id(), drive_id=drive_zoho.drive_id, round_type=RoundType.CODING, round_number=2, round_name="Advanced Coding", description="4 problems - DP, graphs, trees, 120 min", total_appeared=30, total_passed=10),
        Round(round_id=_id(), drive_id=drive_zoho.drive_id, round_type=RoundType.TECHNICAL, round_number=3, round_name="Technical Interview 1", description="Deep DS/Algo + system design", total_appeared=10, total_passed=6),
        Round(round_id=_id(), drive_id=drive_zoho.drive_id, round_type=RoundType.TECHNICAL, round_number=4, round_name="Technical Interview 2", description="OOPS, design patterns, architecture", total_appeared=6, total_passed=4),
        Round(round_id=_id(), drive_id=drive_zoho.drive_id, round_type=RoundType.HR, round_number=5, round_name="HR Interview", description="Culture fit and expectations", total_appeared=4, total_passed=3),
    ]
    db.add_all(tcs_rounds + infy_rounds + zoho_rounds)
    db.flush()

    # Helper to get round by drive and number
    all_rounds = {
        (r.drive_id, r.round_number): r
        for r in tcs_rounds + infy_rounds + zoho_rounds
    }

    def add_result(student, drive, round_num, result, score=None, max_score=None,
                   rejection_reason=None, feedback=None, weakness=None):
        r = all_rounds[(drive.drive_id, round_num)]
        db.add(RoundResult(
            result_id=_id(), student_id=student.student_id,
            round_id=r.round_id, drive_id=drive.drive_id,
            result=result, score=score, max_score=max_score,
            rejection_reason=rejection_reason, feedback=feedback,
            weakness_area=weakness, attempt_date=drive.drive_date,
        ))

    def add_reg(student, drive, status, cleared):
        db.add(StudentDriveRegistration(
            registration_id=_id(), student_id=student.student_id,
            drive_id=drive.drive_id, final_status=status,
            rounds_cleared=cleared,
        ))

    rahul, ananya, vikram, deepa, arjun = students[0], students[1], students[2], students[3], students[4]
    priya_s, kiran, sneha, manoj, divya = students[5], students[6], students[7], students[8], students[9]

    # Rahul — repeatedly fails CODING (3x), fails TECHNICAL once
    add_result(rahul, drive_tcs, 1, Result.PASSED, 78, 100)
    add_result(rahul, drive_tcs, 2, Result.FAILED, 30, 100, "Could not solve DP problem", "Good approach Q1, TLE on Q2, no attempt Q3", "Dynamic Programming")
    add_reg(rahul, drive_tcs, "REJECTED", 1)

    add_result(rahul, drive_infosys, 1, Result.PASSED, 82, 100)
    add_result(rahul, drive_infosys, 2, Result.FAILED, 35, 100, "Partial solution on array, failed DP", "Solved array problem, DP approach wrong", "Dynamic Programming")
    add_reg(rahul, drive_infosys, "REJECTED", 1)

    add_result(rahul, drive_zoho, 1, Result.PASSED, 65, 100)
    add_result(rahul, drive_zoho, 2, Result.FAILED, 25, 100, "Solved 1/4, failed DP and graph", "Only solved simple array problem", "Dynamic Programming")
    add_reg(rahul, drive_zoho, "REJECTED", 1)

    # Vikram — fails APTITUDE repeatedly (low placement marks)
    add_result(vikram, drive_tcs, 1, Result.FAILED, 35, 100, "Below cutoff", "Weak in quantitative", "Aptitude - Quantitative")
    add_reg(vikram, drive_tcs, "REJECTED", 0)

    add_result(vikram, drive_infosys, 1, Result.FAILED, 40, 100, "Below cutoff", "Logical ok, quant weak, verbal average", "Aptitude - Quantitative")
    add_reg(vikram, drive_infosys, "REJECTED", 0)

    # Deepa — passes aptitude, fails TECHNICAL interviews
    add_result(deepa, drive_tcs, 1, Result.PASSED, 72, 100)
    add_result(deepa, drive_tcs, 2, Result.PASSED, 60, 100)
    add_result(deepa, drive_tcs, 3, Result.FAILED, None, None, "Could not explain OOPS concepts clearly", "Knows syntax but not concepts, nervous", "OOPS Concepts")
    add_reg(deepa, drive_tcs, "REJECTED", 2)

    add_result(deepa, drive_infosys, 1, Result.PASSED, 70, 100)
    add_result(deepa, drive_infosys, 2, Result.PASSED, 55, 100)
    add_result(deepa, drive_infosys, 3, Result.FAILED, None, None, "Weak project explanation, poor system design understanding", "Could not draw architecture diagram", "System Design")
    add_reg(deepa, drive_infosys, "REJECTED", 2)

    # Arjun — fails HR/soft skills (clears everything else)
    add_result(arjun, drive_tcs, 1, Result.PASSED, 80, 100)
    add_result(arjun, drive_tcs, 2, Result.PASSED, 75, 100)
    add_result(arjun, drive_tcs, 3, Result.PASSED)
    add_result(arjun, drive_tcs, 4, Result.FAILED, None, None, "Poor communication, not a culture fit", "Technically strong but could not articulate answers", "Communication")
    add_reg(arjun, drive_tcs, "REJECTED", 3)

    add_result(arjun, drive_infosys, 1, Result.PASSED, 85, 100)
    add_result(arjun, drive_infosys, 2, Result.PASSED, 80, 100)
    add_result(arjun, drive_infosys, 3, Result.PASSED)
    add_result(arjun, drive_infosys, 4, Result.FAILED, None, None, "Struggled with behavioral questions", "Needs to work on STAR method answers", "Communication")
    add_reg(arjun, drive_infosys, "REJECTED", 3)

    # Kiran — fails everything early (low CGPA, low skills)
    add_result(kiran, drive_infosys, 1, Result.FAILED, 30, 100, "Well below cutoff", "Weak across all sections", "Aptitude - Overall")
    add_reg(kiran, drive_infosys, "REJECTED", 0)

    # Sneha — gets selected (control case, should NOT get intervention)
    add_result(sneha, drive_zoho, 1, Result.PASSED, 92, 100)
    add_result(sneha, drive_zoho, 2, Result.PASSED, 88, 100)
    add_result(sneha, drive_zoho, 3, Result.PASSED)
    add_result(sneha, drive_zoho, 4, Result.PASSED)
    add_result(sneha, drive_zoho, 5, Result.PASSED)
    add_reg(sneha, drive_zoho, "SELECTED", 5)

    # Priya — mixed, fails coding once then recovers
    add_result(priya_s, drive_tcs, 1, Result.PASSED, 85, 100)
    add_result(priya_s, drive_tcs, 2, Result.FAILED, 45, 100, "Close but missed edge cases", "Good logic, missed edge case in problem 2", "Edge Case Handling")
    add_reg(priya_s, drive_tcs, "REJECTED", 1)

    add_result(priya_s, drive_infosys, 1, Result.PASSED, 88, 100)
    add_result(priya_s, drive_infosys, 2, Result.PASSED, 70, 100)
    add_result(priya_s, drive_infosys, 3, Result.PASSED)
    add_result(priya_s, drive_infosys, 4, Result.PASSED)
    add_reg(priya_s, drive_infosys, "SELECTED", 4)

    # Manoj — fails technical, similar to Deepa
    add_result(manoj, drive_tcs, 1, Result.PASSED, 70, 100)
    add_result(manoj, drive_tcs, 2, Result.PASSED, 55, 100)
    add_result(manoj, drive_tcs, 3, Result.FAILED, None, None, "Could not answer OS and DBMS questions", "Very weak fundamentals", "Core CS Subjects")
    add_reg(manoj, drive_tcs, "REJECTED", 2)

    # Divya — passes aptitude and coding, fails managerial at Zoho
    add_result(divya, drive_zoho, 1, Result.PASSED, 75, 100)
    add_result(divya, drive_zoho, 2, Result.PASSED, 60, 100)
    add_result(divya, drive_zoho, 3, Result.PASSED)
    add_result(divya, drive_zoho, 4, Result.FAILED, None, None, "Could not handle design pattern questions", "Needs more practice with real-world architecture", "Design Patterns")
    add_reg(divya, drive_zoho, "REJECTED", 3)

    # --- Mentor-Student Assignments ---
    # Prof. Arun (DSA) mentors students who struggle with coding
    for s in [rahul, deepa, divya, priya_s]:
        db.add(MentorStudent(id=_id(), mentor_id=mentor_dsa.mentor_id, student_id=s.student_id))
    mentor_dsa.current_mentee_count = 4 + 3  # 3 existing + 4 new

    # Prof. Meena (System Design) mentors technical-failure students
    for s in [deepa, manoj, vikram]:
        db.add(MentorStudent(id=_id(), mentor_id=mentor_sys.mentor_id, student_id=s.student_id))
    mentor_sys.current_mentee_count = 2 + 3

    # Prof. Karthik (Soft Skills) mentors HR-failure and all-round students
    for s in [arjun, kiran, sneha, ananya]:
        db.add(MentorStudent(id=_id(), mentor_id=mentor_soft.mentor_id, student_id=s.student_id))
    mentor_soft.current_mentee_count = 5 + 4

    db.commit()
    print(f"Seeded: {db.query(Student).count()} students, {db.query(Drive).count()} drives, {db.query(RoundResult).count()} round results")


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    import app.models  # noqa: F401
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
