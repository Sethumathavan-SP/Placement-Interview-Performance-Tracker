from collections import Counter, defaultdict
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.enums import Result
from app.models import Coordinator, Drive, Mentor, Round, RoundResult, Student, StudentDriveRegistration


class CurrentUser(BaseModel):
    """Database-backed request identity used by the analysis routes."""

    id: str
    name: str
    role: str
    department: Optional[str] = None
    student_id: Optional[str] = None


def current_user(db: Session, x_user_id: str, x_user_role: Optional[str] = None) -> CurrentUser:
    """Resolve an analysis user from the existing student, coordinator, or mentor tables."""
    student = db.query(Student).filter(Student.student_id == x_user_id).first()
    if student:
        return CurrentUser(id=student.student_id, name=student.name, role="student", department=student.department, student_id=student.student_id)

    coordinator = db.query(Coordinator).filter(Coordinator.coordinator_id == x_user_id).first()
    if coordinator:
        role = x_user_role or "department_coordinator"
        if role not in {"placement_coordinator", "department_coordinator"}:
            raise ValueError("Coordinator role must be placement_coordinator or department_coordinator")
        return CurrentUser(id=coordinator.coordinator_id, name=coordinator.name, role=role, department=coordinator.department)

    mentor = db.query(Mentor).filter(Mentor.mentor_id == x_user_id).first()
    if mentor:
        return CurrentUser(id=mentor.mentor_id, name=mentor.name, role="mentor", department=mentor.department)
    raise ValueError("Unknown X-User-Id")


def student_applications(db: Session, student_id: str) -> list[dict]:
    """Return a student's registered drives and their recorded round results."""
    registrations = (
        db.query(StudentDriveRegistration, Drive)
        .join(Drive, StudentDriveRegistration.drive_id == Drive.drive_id)
        .filter(StudentDriveRegistration.student_id == student_id)
        .order_by(Drive.drive_date)
        .all()
    )
    results = (
        db.query(RoundResult, Round)
        .join(Round, RoundResult.round_id == Round.round_id)
        .filter(RoundResult.student_id == student_id)
        .order_by(RoundResult.attempt_date, Round.round_number)
        .all()
    )
    results_by_drive: dict[str, list[dict]] = defaultdict(list)
    for result, round_ in results:
        results_by_drive[result.drive_id].append({
            "number": round_.round_number,
            "name": round_.round_type.value,
            "round_name": round_.round_name,
            "outcome": result.result.value.lower(),
            "reason": result.rejection_reason or result.feedback,
            "weakness_area": result.weakness_area,
            "score": result.score,
        })
    return [{
        "id": registration.registration_id,
        "drive_id": drive.drive_id,
        "company": drive.company_name,
        "job_role": drive.role_title,
        "applied_on": drive.drive_date,
        "final_status": registration.final_status,
        "rounds": results_by_drive[drive.drive_id],
    } for registration, drive in registrations]


def assert_can_view_student(user: CurrentUser, student: Student) -> None:
    if user.role == "placement_coordinator":
        return
    if user.role in {"department_coordinator", "mentor"} and user.department == student.department:
        return
    if user.role == "student" and user.student_id == student.student_id:
        return
    raise PermissionError("You cannot view this student's analysis")


def accessible_students(db: Session, user: CurrentUser) -> list[Student]:
    query = db.query(Student)
    if user.role == "placement_coordinator":
        return query.order_by(Student.name).all()
    if user.role in {"department_coordinator", "mentor"}:
        return query.filter(Student.department == user.department).order_by(Student.name).all()
    if user.role == "student" and user.student_id:
        student = query.filter(Student.student_id == user.student_id).first()
        return [student] if student else []
    return []


def recommendation(round_name: Optional[str]) -> str:
    suggestions = {
        "APTITUDE": "Assign timed quantitative aptitude practice and a weekly mock test.",
        "CODING": "Assign DSA, arrays, SQL practice, and a mentor-led coding review.",
        "TECHNICAL": "Schedule an OOP, DBMS, and project-explanation mock interview.",
        "MANAGERIAL": "Schedule a system-design and project-leadership mock interview.",
        "HR": "Schedule an HR mock interview focused on communication and confidence.",
        "GROUP_DISCUSSION": "Assign a group-discussion practice session with structured feedback.",
    }
    return suggestions.get(round_name or "", "Schedule a mentor review and targeted practice plan.")


def analyse_student(db: Session, student_id: str) -> dict:
    """Detailed, database-backed version of the former mock failure analysis."""
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise ValueError(f"Student {student_id} not found")
    applications = student_applications(db, student_id)
    round_stats = defaultdict(lambda: {"attempted": 0, "passed": 0, "failed": 0})
    reasons: list[str] = []
    for application in applications:
        for result in application["rounds"]:
            stats = round_stats[result["name"]]
            stats["attempted"] += 1
            stats[result["outcome"]] += 1
            if result["outcome"] == "failed" and result["reason"]:
                reasons.append(result["reason"])
    summary = [{"round": name, **stats, "failure_rate": round(stats["failed"] / stats["attempted"] * 100, 1)} for name, stats in sorted(round_stats.items())]
    failed_rounds = [(name, values["failed"]) for name, values in round_stats.items() if values["failed"]]
    primary_round, failure_count = max(failed_rounds, key=lambda item: item[1], default=(None, 0))
    repeated = failure_count >= 2
    risk = "high" if failure_count >= 2 else "medium" if failure_count == 1 else "low"
    return {
        "student": {"id": student.student_id, "name": student.name, "register_number": student.register_number, "department": student.department, "cgpa": student.cgpa},
        "total_applications": len(applications),
        "placed": any(item["final_status"] == "SELECTED" for item in applications),
        "round_failure_summary": summary,
        "primary_failure_pattern": {
            "pattern": f"Repeated {primary_round} failure" if repeated else (f"{primary_round} failure" if primary_round else "No failure pattern detected"),
            "evidence": f"Failed {primary_round} in {failure_count} application(s)" if primary_round else "No failed interview rounds found",
            "risk_level": risk,
            "recommended_action": recommendation(primary_round) if primary_round else "Continue regular placement preparation.",
        },
        "recent_failure_reasons": reasons[-5:],
        "applications": applications,
    }


def compact_student_analysis(db: Session, student: Student) -> dict:
    analysis = analyse_student(db, student.student_id)
    pattern = analysis["primary_failure_pattern"]
    return {
        "student_id": student.student_id, "name": student.name, "register_number": student.register_number,
        "department": student.department, "cgpa": student.cgpa, "applications": analysis["total_applications"],
        "placed": analysis["placed"], "primary_failure_pattern": pattern["pattern"], "risk_level": pattern["risk_level"],
    }


def analyze_student_patterns(db: Session, student_id: str) -> dict:
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise ValueError(f"Student {student_id} not found")
    registrations = db.query(StudentDriveRegistration).filter(StudentDriveRegistration.student_id == student_id).all()
    total_attempted = len(registrations)
    total_cleared = sum(1 for registration in registrations if registration.final_status == "SELECTED")
    results = (
        db.query(RoundResult, Round, Drive).join(Round, RoundResult.round_id == Round.round_id)
        .join(Drive, RoundResult.drive_id == Drive.drive_id).filter(RoundResult.student_id == student_id)
        .order_by(Drive.drive_date, Round.round_number).all()
    )
    failure_by_round: dict[str, dict] = defaultdict(lambda: {"count": 0, "drives": []})
    weakness_counter: Counter = Counter()
    always_pass_rounds: dict[str, list[bool]] = defaultdict(list)
    score_trend: list[float] = []
    for rr, rnd, drv in results:
        round_type = rnd.round_type.value
        passed = rr.result == Result.PASSED
        always_pass_rounds[round_type].append(passed)
        if not passed:
            failure_by_round[round_type]["count"] += 1
            if drv.company_name not in failure_by_round[round_type]["drives"]:
                failure_by_round[round_type]["drives"].append(drv.company_name)
            if rr.weakness_area:
                weakness_counter[rr.weakness_area] += 1
            if rr.score is not None:
                score_trend.append(rr.score)
    always_clears = [round_type for round_type, outcomes in always_pass_rounds.items() if all(outcomes) and outcomes]
    biggest_bottleneck = max(failure_by_round, key=lambda key: failure_by_round[key]["count"]) if failure_by_round else None
    return {
        "student_id": student_id, "student_name": student.name, "department": student.department, "cgpa": student.cgpa,
        "total_drives_attempted": total_attempted, "total_drives_cleared": total_cleared,
        "failure_by_round_type": dict(failure_by_round), "weakness_areas": dict(weakness_counter),
        "score_trend": score_trend, "failure_trend": _compute_trend(score_trend),
        "always_clears": always_clears, "biggest_bottleneck": biggest_bottleneck,
    }


def _compute_trend(scores: list[float]) -> str:
    if len(scores) < 2:
        return "INSUFFICIENT_DATA"
    differences = [scores[index + 1] - scores[index] for index in range(len(scores) - 1)]
    average_difference = sum(differences) / len(differences)
    if average_difference > 2:
        return "IMPROVING"
    if average_difference < -2:
        return "WORSENING"
    return "STABLE"


def get_at_risk_students(db: Session, min_failures: int = 2) -> list[dict]:
    failure_counts = (
        db.query(RoundResult.student_id, func.count(RoundResult.result_id).label("fail_count"))
        .filter(RoundResult.result == Result.FAILED).group_by(RoundResult.student_id)
        .having(func.count(RoundResult.result_id) >= min_failures).all()
    )
    at_risk = []
    for student_id, fail_count in failure_counts:
        has_selection = db.query(StudentDriveRegistration).filter(
            StudentDriveRegistration.student_id == student_id,
            StudentDriveRegistration.final_status == "SELECTED",
        ).first()
        if has_selection:
            continue
        student = db.query(Student).filter(Student.student_id == student_id).first()
        at_risk.append({"student_id": student_id, "student_name": student.name, "department": student.department, "cgpa": student.cgpa, "total_failures": fail_count})
    at_risk.sort(key=lambda student: student["total_failures"], reverse=True)
    return at_risk


def view_overall_pattern(db: Session) -> dict:
    """viewOverAllPattern() — Failure breakdown across all departments and students."""
    students = db.query(Student).all()
    student_ids = [s.student_id for s in students]
    distinct_departments = db.query(Student.department).distinct().all()

    total_failures = (
        db.query(RoundResult)
        .filter(RoundResult.result == Result.FAILED)
        .count()
    )

    results = (
        db.query(RoundResult)
        .filter(RoundResult.result == Result.FAILED)
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

    failure_patterns = []
    for rtype, count in sorted(by_type.items(), key=lambda x: -x[1]):
        top_weaknesses = sorted(
            weaknesses.get(rtype, {}).items(), key=lambda x: -x[1]
        )[:5]
        failure_patterns.append({
            "round_type": rtype,
            "total_failures": count,
            "percentage_of_total": round(count / total_failures * 100, 1) if total_failures > 0 else 0.0,
            "common_weaknesses": [w[0] for w in top_weaknesses],
        })

    most_failed = max(by_type, key=by_type.get) if by_type else None

    at_risk = 0
    for sid in student_ids:
        failed_count = (
            db.query(RoundResult)
            .filter(RoundResult.student_id == sid, RoundResult.result == Result.FAILED)
            .count()
        )
        if failed_count >= 3:
            at_risk += 1

    return {
        "total_students": len(students),
        "total_departments": len(distinct_departments),
        "total_failures": total_failures,
        "failure_by_round_type": failure_patterns,
        "most_failed_round": most_failed,
        "at_risk_count": at_risk,
    }


viewOverAllPattern = view_overall_pattern

