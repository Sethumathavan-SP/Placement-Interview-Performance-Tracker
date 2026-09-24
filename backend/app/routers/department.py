from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Student,
    Mentor,
    Drive,
    Round,
    RoundResult,
    StudentDriveRegistration,
)
from app.schemas.department import (
    DepartmentAnalysisOut,
    DepartmentFailurePatternResponse,
    DepartmentMentorOut,
    DepartmentOverview,
    DepartmentRoundsResponse,
    DepartmentStudentOut,
    DepartmentWiseAnalysisResponse,
    FailurePatternOut,
    OverallFailurePatternResponse,
    RoundSummaryOut,
)
from app.services.pattern_analyzer import view_overall_pattern


router = APIRouter(prefix="/api/department", tags=["department"])


def _get_all_departments(db: Session) -> list[str]:
    rows = db.query(Student.department).distinct().all()
    return sorted([r[0] for r in rows])


def _students_in_dept(db: Session, department: str) -> list[Student]:
    return db.query(Student).filter(Student.department == department).all()


def _mentors_in_dept(db: Session, department: str) -> list[Mentor]:
    return db.query(Mentor).filter(Mentor.department == department).all()


def _failure_stats(db: Session, student_ids: list[str]) -> dict:
    if not student_ids:
        return {"total": 0, "by_type": {}, "weaknesses": {}}

    results = (
        db.query(RoundResult)
        .filter(
            RoundResult.student_id.in_(student_ids),
            RoundResult.result == "FAILED",
        )
        .all()
    )

    by_type: dict[str, int] = {}
    weaknesses: dict[str, dict[str, int]] = {}

    for r in results:
        round_obj = db.query(Round).filter(Round.round_id == r.round_id).first()
        if round_obj:
            rtype = round_obj.round_type.value
            by_type[rtype] = by_type.get(rtype, 0) + 1
            if rtype not in weaknesses:
                weaknesses[rtype] = {}
            if r.weakness_area:
                weaknesses[rtype][r.weakness_area] = weaknesses[rtype].get(r.weakness_area, 0) + 1

    return {"total": len(results), "by_type": by_type, "weaknesses": weaknesses}


@router.get("/list", response_model=list[DepartmentOverview])
def list_departments(db: Session = Depends(get_db)):
    departments = _get_all_departments(db)
    result = []
    for dept in departments:
        students = _students_in_dept(db, dept)
        mentors = _mentors_in_dept(db, dept)
        student_ids = [s.student_id for s in students]

        placed = 0
        if student_ids:
            placed = (
                db.query(StudentDriveRegistration)
                .filter(
                    StudentDriveRegistration.student_id.in_(student_ids),
                    StudentDriveRegistration.final_status == "SELECTED",
                )
                .distinct(StudentDriveRegistration.student_id)
                .count()
            )

        total = len(students)
        result.append(DepartmentOverview(
            department=dept,
            total_students=total,
            total_mentors=len(mentors),
            placed_students=placed,
            placement_rate=round(placed / total * 100, 1) if total > 0 else 0,
        ))
    return result


@router.get("/{department}/students", response_model=list[DepartmentStudentOut])
def get_department_students(department: str, db: Session = Depends(get_db)):
    students = _students_in_dept(db, department)
    if not students:
        raise HTTPException(status_code=404, detail="Department not found or has no students")

    result = []
    for s in students:
        regs = (
            db.query(StudentDriveRegistration)
            .filter(StudentDriveRegistration.student_id == s.student_id)
            .all()
        )
        selected = sum(1 for r in regs if r.final_status == "SELECTED")
        failed = (
            db.query(RoundResult)
            .filter(RoundResult.student_id == s.student_id, RoundResult.result == "FAILED")
            .count()
        )

        result.append(DepartmentStudentOut(
            student_id=s.student_id,
            name=s.name,
            register_number=s.register_number,
            email=s.email,
            cgpa=s.cgpa,
            total_drives_applied=len(regs),
            drives_selected=selected,
            rounds_failed=failed,
        ))
    return result


@router.get("/{department}/mentors", response_model=list[DepartmentMentorOut])
def get_department_mentors(department: str, db: Session = Depends(get_db)):
    mentors = _mentors_in_dept(db, department)
    if not mentors:
        raise HTTPException(status_code=404, detail="Department not found or has no mentors")

    return [
        DepartmentMentorOut(
            mentor_id=m.mentor_id,
            name=m.name,
            email=m.email,
            specialization=m.specialization,
            max_mentees=m.max_mentees,
            current_mentee_count=m.current_mentee_count,
        )
        for m in mentors
    ]


@router.get("/{department}/rounds", response_model=DepartmentRoundsResponse)
def view_rounds(department: str, db: Session = Depends(get_db)):
    """viewRounds() — All rounds across all drives for students in a department."""
    students = _students_in_dept(db, department)
    if not students:
        raise HTTPException(status_code=404, detail="Department not found or has no students")

    student_ids = [s.student_id for s in students]

    drive_ids = set()
    regs = (
        db.query(StudentDriveRegistration)
        .filter(StudentDriveRegistration.student_id.in_(student_ids))
        .all()
    )
    for reg in regs:
        drive_ids.add(reg.drive_id)

    rounds_out = []
    for drive_id in drive_ids:
        drive = db.query(Drive).filter(Drive.drive_id == drive_id).first()
        if not drive:
            continue

        rounds = db.query(Round).filter(Round.drive_id == drive_id).order_by(Round.round_number).all()
        for rnd in rounds:
            results = (
                db.query(RoundResult)
                .filter(
                    RoundResult.round_id == rnd.round_id,
                    RoundResult.student_id.in_(student_ids),
                )
                .all()
            )
            passed = sum(1 for r in results if r.result.value == "PASSED")
            failed = sum(1 for r in results if r.result.value == "FAILED")
            total = passed + failed

            rounds_out.append(RoundSummaryOut(
                drive_id=drive_id,
                company_name=drive.company_name,
                round_name=rnd.round_name,
                round_type=rnd.round_type.value,
                round_number=rnd.round_number,
                total_appeared=total,
                total_passed=passed,
                total_failed=failed,
                pass_rate=round(passed / total * 100, 1) if total > 0 else 0,
            ))

    return DepartmentRoundsResponse(
        department=department,
        total_drives=len(drive_ids),
        rounds=rounds_out,
    )


@router.get("/{department}/failure-pattern", response_model=DepartmentFailurePatternResponse)
def view_failure_pattern(department: str, db: Session = Depends(get_db)):
    """viewFailurePattern() — Failure breakdown by round type for the department."""
    students = _students_in_dept(db, department)
    if not students:
        raise HTTPException(status_code=404, detail="Department not found or has no students")

    student_ids = [s.student_id for s in students]
    stats = _failure_stats(db, student_ids)

    total_failures = stats["total"]
    failure_patterns = []
    for rtype, count in sorted(stats["by_type"].items(), key=lambda x: -x[1]):
        top_weaknesses = sorted(
            stats["weaknesses"].get(rtype, {}).items(), key=lambda x: -x[1]
        )[:5]
        failure_patterns.append(FailurePatternOut(
            round_type=rtype,
            total_failures=count,
            percentage_of_total=round(count / total_failures * 100, 1) if total_failures > 0 else 0,
            common_weaknesses=[w[0] for w in top_weaknesses],
        ))

    most_failed = max(stats["by_type"], key=stats["by_type"].get) if stats["by_type"] else None

    at_risk = 0
    for sid in student_ids:
        failed_count = (
            db.query(RoundResult)
            .filter(RoundResult.student_id == sid, RoundResult.result == "FAILED")
            .count()
        )
        if failed_count >= 3:
            at_risk += 1

    return DepartmentFailurePatternResponse(
        department=department,
        total_students=len(students),
        total_failures=total_failures,
        failure_by_round_type=failure_patterns,
        most_failed_round=most_failed,
        at_risk_count=at_risk,
    )


@router.get("/analysis", response_model=DepartmentWiseAnalysisResponse)
def department_wise_analysis(db: Session = Depends(get_db)):
    """DepartmentWiseAnalysis() — Cross-department comparison."""
    departments = _get_all_departments(db)
    dept_results = []

    for dept in departments:
        students = _students_in_dept(db, dept)
        mentors = _mentors_in_dept(db, dept)
        student_ids = [s.student_id for s in students]
        total = len(students)

        placed = 0
        if student_ids:
            placed = (
                db.query(StudentDriveRegistration)
                .filter(
                    StudentDriveRegistration.student_id.in_(student_ids),
                    StudentDriveRegistration.final_status == "SELECTED",
                )
                .distinct(StudentDriveRegistration.student_id)
                .count()
            )

        stats = _failure_stats(db, student_ids)
        most_failed = max(stats["by_type"], key=stats["by_type"].get) if stats["by_type"] else None

        at_risk = 0
        for sid in student_ids:
            failed_count = (
                db.query(RoundResult)
                .filter(RoundResult.student_id == sid, RoundResult.result == "FAILED")
                .count()
            )
            if failed_count >= 3:
                at_risk += 1

        avg_cgpa = round(sum(s.cgpa for s in students) / total, 2) if total > 0 else 0

        dept_results.append(DepartmentAnalysisOut(
            department=dept,
            total_students=total,
            total_mentors=len(mentors),
            placed_students=placed,
            placement_rate=round(placed / total * 100, 1) if total > 0 else 0,
            total_failures=stats["total"],
            most_failed_round=most_failed,
            at_risk_count=at_risk,
            avg_cgpa=avg_cgpa,
        ))

    return DepartmentWiseAnalysisResponse(
        total_departments=len(departments),
        departments=dept_results,
    )


@router.get("/overall-pattern", response_model=OverallFailurePatternResponse)
def view_overall_pattern_route(db: Session = Depends(get_db)):
    """viewOverAllPattern() — Failure breakdown across all departments and students."""
    data = view_overall_pattern(db)
    return OverallFailurePatternResponse(**data)


viewOverAllPattern = view_overall_pattern_route

