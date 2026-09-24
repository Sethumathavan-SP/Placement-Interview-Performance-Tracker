from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.enums import InterventionStatus, Result
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
from app.schemas.mentor import (
    ActionProgressUpdate,
    AssignStudentRequest,
    MenteeMetricOut,
    MenteeOut,
    MenteeRoundOut,
    MentorDashboardOut,
    MentorInterventionActionOut,
    MentorInterventionCreate,
    MentorInterventionOut,
    MentorMetricsOut,
    MentorNoteCreate,
    MentorNoteOut,
    MentorNoteUpdate,
    MentorOut,
    PlacedMenteeOut,
    StudentDetailOut,
    StudentJobApplicationOut,
    ViewRoundsResponse,
)
from app.services.groq_agent import generate_intervention

router = APIRouter(prefix="/api/mentor", tags=["mentor"])


def _get_mentor_or_404(mentor_id: str, db: Session) -> Mentor:
    mentor = db.query(Mentor).filter(Mentor.mentor_id == mentor_id).first()
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor not found")
    return mentor


def _get_mentee_ids(mentor_id: str, db: Session) -> list[str]:
    assignments = (
        db.query(MentorStudent)
        .filter(MentorStudent.mentor_id == mentor_id)
        .all()
    )
    return [a.student_id for a in assignments]


@router.get("/", response_model=list[MentorOut])
def list_mentors(db: Session = Depends(get_db)):
    return db.query(Mentor).order_by(Mentor.name).all()


@router.get("/{mentor_id}", response_model=MentorOut)
def get_mentor_profile(mentor_id: str, db: Session = Depends(get_db)):
    return _get_mentor_or_404(mentor_id, db)


@router.get("/{mentor_id}/dashboard", response_model=MentorDashboardOut)
def get_mentor_dashboard(mentor_id: str, db: Session = Depends(get_db)):
    mentor = _get_mentor_or_404(mentor_id, db)
    mentee_ids = _get_mentee_ids(mentor_id, db)

    placed_count = 0
    at_risk_count = 0
    for sid in mentee_ids:
        selected = (
            db.query(StudentDriveRegistration)
            .filter(
                StudentDriveRegistration.student_id == sid,
                StudentDriveRegistration.final_status == "SELECTED",
            )
            .first()
        )
        if selected:
            placed_count += 1
            continue
        fail_count = (
            db.query(RoundResult)
            .filter(RoundResult.student_id == sid, RoundResult.result == Result.FAILED)
            .count()
        )
        if fail_count >= 2:
            at_risk_count += 1

    active_interventions = (
        db.query(Intervention)
        .filter(
            Intervention.mentor_id == mentor_id,
            Intervention.status.in_([
                InterventionStatus.APPROVED,
                InterventionStatus.IN_PROGRESS,
            ]),
        )
        .count()
    )

    pending_actions = (
        db.query(InterventionAction)
        .join(Intervention, InterventionAction.intervention_id == Intervention.intervention_id)
        .filter(
            Intervention.mentor_id == mentor_id,
            InterventionAction.is_completed == False,
        )
        .count()
    )

    return MentorDashboardOut(
        mentor=MentorOut.model_validate(mentor),
        total_mentees=len(mentee_ids),
        placed_mentees=placed_count,
        at_risk_mentees=at_risk_count,
        active_interventions=active_interventions,
        pending_actions=pending_actions,
    )


@router.get("/{mentor_id}/students", response_model=list[MenteeOut])
def list_mentees(mentor_id: str, db: Session = Depends(get_db)):
    """List[student ID] -- view all assigned mentees."""
    _get_mentor_or_404(mentor_id, db)
    assignments = (
        db.query(MentorStudent)
        .filter(MentorStudent.mentor_id == mentor_id)
        .order_by(MentorStudent.assigned_at)
        .all()
    )
    mentees = []
    for assignment in assignments:
        student = db.query(Student).filter(Student.student_id == assignment.student_id).first()
        if not student:
            continue
        mentees.append(MenteeOut(
            student_id=student.student_id,
            name=student.name,
            register_number=student.register_number,
            department=student.department,
            email=student.email,
            cgpa=student.cgpa,
            placement_marks=student.placement_marks,
            skills=student.skills,
            assigned_at=assignment.assigned_at,
        ))
    return mentees


@router.get("/{mentor_id}/placed-students", response_model=list[PlacedMenteeOut])
def list_placed_mentees(mentor_id: str, db: Session = Depends(get_db)):
    """list[Placed Student ID] -- view mentees who got placed."""
    _get_mentor_or_404(mentor_id, db)
    mentee_ids = _get_mentee_ids(mentor_id, db)

    placed = []
    for sid in mentee_ids:
        reg = (
            db.query(StudentDriveRegistration)
            .filter(
                StudentDriveRegistration.student_id == sid,
                StudentDriveRegistration.final_status == "SELECTED",
            )
            .first()
        )
        if not reg:
            continue
        student = db.query(Student).filter(Student.student_id == sid).first()
        drive = db.query(Drive).filter(Drive.drive_id == reg.drive_id).first()
        if not student or not drive:
            continue
        placed.append(PlacedMenteeOut(
            student_id=student.student_id,
            name=student.name,
            register_number=student.register_number,
            department=student.department,
            cgpa=student.cgpa,
            placed_company=drive.company_name,
            role_title=drive.role_title,
            package_lpa=drive.package_lpa,
        ))
    return placed


@router.get("/{mentor_id}/students/{student_id}/rounds", response_model=ViewRoundsResponse)
def view_rounds(mentor_id: str, student_id: str, db: Session = Depends(get_db)):
    """viewRounds() -- Mentor views a mentee's round-by-round performance."""
    _get_mentor_or_404(mentor_id, db)

    assignment = (
        db.query(MentorStudent)
        .filter(MentorStudent.mentor_id == mentor_id, MentorStudent.student_id == student_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=403, detail="Student is not assigned to this mentor")

    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    results = (
        db.query(RoundResult)
        .filter(RoundResult.student_id == student_id)
        .all()
    )

    drive_ids = set()
    rounds = []
    passed = 0
    failed = 0
    for r in results:
        drive_ids.add(r.drive_id)
        round_obj = db.query(Round).filter(Round.round_id == r.round_id).first()
        drive_obj = db.query(Drive).filter(Drive.drive_id == r.drive_id).first()
        if not round_obj or not drive_obj:
            continue

        if r.result == Result.PASSED:
            passed += 1
        else:
            failed += 1

        rounds.append(MenteeRoundOut(
            drive_id=r.drive_id,
            company_name=drive_obj.company_name,
            role_title=drive_obj.role_title,
            drive_date=drive_obj.drive_date,
            round_number=round_obj.round_number,
            round_name=round_obj.round_name,
            round_type=round_obj.round_type.value,
            result=r.result.value,
            score=r.score,
            max_score=r.max_score,
            rejection_reason=r.rejection_reason,
            feedback=r.feedback,
            weakness_area=r.weakness_area,
            attempt_date=r.attempt_date,
        ))

    rounds.sort(key=lambda x: (x.drive_id, x.round_number))

    return ViewRoundsResponse(
        student_id=student_id,
        student_name=student.name,
        department=student.department,
        cgpa=student.cgpa,
        total_drives=len(drive_ids),
        total_rounds_attempted=len(results),
        rounds_passed=passed,
        rounds_failed=failed,
        rounds=rounds,
    )


@router.post("/{mentor_id}/interventions", response_model=MentorInterventionOut)
def create_mentor_intervention(
    mentor_id: str, body: MentorInterventionCreate, db: Session = Depends(get_db),
):
    """intervention() -- Mentor triggers an intervention for a mentee."""
    mentor = _get_mentor_or_404(mentor_id, db)

    assignment = (
        db.query(MentorStudent)
        .filter(MentorStudent.mentor_id == mentor_id, MentorStudent.student_id == body.student_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=403, detail="Student is not assigned to this mentor")

    student = db.query(Student).filter(Student.student_id == body.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    coordinator = db.query(Coordinator).filter(Coordinator.coordinator_id == body.coordinator_id).first()
    if not coordinator:
        raise HTTPException(status_code=404, detail="Coordinator not found")

    try:
        result = generate_intervention(db, body.student_id, body.coordinator_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    intervention = Intervention(
        student_id=body.student_id,
        coordinator_id=body.coordinator_id,
        mentor_id=mentor_id,
        trigger_reason=result["trigger_reason"],
        failure_summary=result["failure_summary"],
        ai_analysis=result["ai_analysis"],
        recommendations=result["recommendations"],
        priority=result["priority"],
        status=InterventionStatus.GENERATED,
    )
    db.add(intervention)
    db.flush()

    for rec in result["recommendations"]:
        action = InterventionAction(
            intervention_id=intervention.intervention_id,
            action_type=rec.get("action_type", "General"),
            title=rec["title"],
            description=rec["description"],
            target_weakness=rec.get("target_weakness", "General"),
            resources=rec.get("resources"),
            assigned_to=mentor_id,
        )
        db.add(action)

    db.commit()
    db.refresh(intervention)

    return MentorInterventionOut(
        intervention_id=intervention.intervention_id,
        student_id=intervention.student_id,
        student_name=student.name,
        coordinator_id=intervention.coordinator_id,
        trigger_reason=intervention.trigger_reason,
        ai_analysis=intervention.ai_analysis,
        priority=intervention.priority.value,
        status=intervention.status.value,
        created_at=intervention.created_at,
        updated_at=intervention.updated_at,
        actions=[MentorInterventionActionOut.model_validate(a) for a in intervention.actions],
    )


@router.get("/{mentor_id}/interventions", response_model=list[MentorInterventionOut])
def list_mentor_interventions(
    mentor_id: str,
    status: str | None = None,
    student_id: str | None = None,
    db: Session = Depends(get_db),
):
    """View all interventions assigned to this mentor."""
    _get_mentor_or_404(mentor_id, db)

    query = db.query(Intervention).filter(Intervention.mentor_id == mentor_id)
    if status:
        query = query.filter(Intervention.status == status)
    if student_id:
        query = query.filter(Intervention.student_id == student_id)
    interventions = query.order_by(Intervention.created_at.desc()).all()

    results = []
    for intv in interventions:
        student = db.query(Student).filter(Student.student_id == intv.student_id).first()
        results.append(MentorInterventionOut(
            intervention_id=intv.intervention_id,
            student_id=intv.student_id,
            student_name=student.name if student else None,
            coordinator_id=intv.coordinator_id,
            trigger_reason=intv.trigger_reason,
            ai_analysis=intv.ai_analysis,
            priority=intv.priority.value,
            status=intv.status.value,
            created_at=intv.created_at,
            updated_at=intv.updated_at,
            actions=[MentorInterventionActionOut.model_validate(a) for a in intv.actions],
        ))
    return results


@router.patch(
    "/{mentor_id}/interventions/{intervention_id}/actions/{action_id}",
    response_model=MentorInterventionOut,
)
def update_action_progress(
    mentor_id: str,
    intervention_id: str,
    action_id: str,
    body: ActionProgressUpdate,
    db: Session = Depends(get_db),
):
    """Mentor updates progress on an intervention action."""
    _get_mentor_or_404(mentor_id, db)

    intervention = (
        db.query(Intervention)
        .filter(
            Intervention.intervention_id == intervention_id,
            Intervention.mentor_id == mentor_id,
        )
        .first()
    )
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found or not assigned to this mentor")

    action = (
        db.query(InterventionAction)
        .filter(
            InterventionAction.action_id == action_id,
            InterventionAction.intervention_id == intervention_id,
        )
        .first()
    )
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    action.is_completed = body.is_completed
    if body.is_completed:
        action.completed_at = datetime.utcnow()
    if body.notes:
        action.notes = body.notes

    all_actions = (
        db.query(InterventionAction)
        .filter(InterventionAction.intervention_id == intervention_id)
        .all()
    )
    if all(a.is_completed for a in all_actions):
        intervention.status = InterventionStatus.COMPLETED
        intervention.completed_at = datetime.utcnow()
    elif intervention.status == InterventionStatus.APPROVED:
        intervention.status = InterventionStatus.IN_PROGRESS

    intervention.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(intervention)

    student = db.query(Student).filter(Student.student_id == intervention.student_id).first()
    return MentorInterventionOut(
        intervention_id=intervention.intervention_id,
        student_id=intervention.student_id,
        student_name=student.name if student else None,
        coordinator_id=intervention.coordinator_id,
        trigger_reason=intervention.trigger_reason,
        ai_analysis=intervention.ai_analysis,
        priority=intervention.priority.value,
        status=intervention.status.value,
        created_at=intervention.created_at,
        updated_at=intervention.updated_at,
        actions=[MentorInterventionActionOut.model_validate(a) for a in intervention.actions],
    )


def _assert_mentee(mentor_id: str, student_id: str, db: Session) -> None:
    assignment = (
        db.query(MentorStudent)
        .filter(MentorStudent.mentor_id == mentor_id, MentorStudent.student_id == student_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=403, detail="Student is not assigned to this mentor")


# ── Notes ──────────────────────────────────────────────────────────


@router.get("/{mentor_id}/students/{student_id}/notes", response_model=list[MentorNoteOut])
def list_notes(mentor_id: str, student_id: str, db: Session = Depends(get_db)):
    _get_mentor_or_404(mentor_id, db)
    _assert_mentee(mentor_id, student_id, db)
    return (
        db.query(MentorNote)
        .filter(MentorNote.mentor_id == mentor_id, MentorNote.student_id == student_id)
        .order_by(MentorNote.created_at.desc())
        .all()
    )


@router.post("/{mentor_id}/students/{student_id}/notes", response_model=MentorNoteOut)
def create_note(mentor_id: str, student_id: str, body: MentorNoteCreate, db: Session = Depends(get_db)):
    _get_mentor_or_404(mentor_id, db)
    _assert_mentee(mentor_id, student_id, db)
    note = MentorNote(mentor_id=mentor_id, student_id=student_id, content=body.content)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/{mentor_id}/notes/{note_id}", response_model=MentorNoteOut)
def update_note(mentor_id: str, note_id: str, body: MentorNoteUpdate, db: Session = Depends(get_db)):
    _get_mentor_or_404(mentor_id, db)
    note = db.query(MentorNote).filter(MentorNote.note_id == note_id, MentorNote.mentor_id == mentor_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    note.content = body.content
    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{mentor_id}/notes/{note_id}", status_code=200)
def delete_note(mentor_id: str, note_id: str, db: Session = Depends(get_db)):
    _get_mentor_or_404(mentor_id, db)
    note = db.query(MentorNote).filter(MentorNote.note_id == note_id, MentorNote.mentor_id == mentor_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"message": "Note deleted"}


# ── Metrics ────────────────────────────────────────────────────────


@router.get("/{mentor_id}/metrics", response_model=MentorMetricsOut)
def get_mentor_metrics(mentor_id: str, db: Session = Depends(get_db)):
    _get_mentor_or_404(mentor_id, db)

    interventions = db.query(Intervention).filter(Intervention.mentor_id == mentor_id).all()
    total_interventions = len(interventions)
    completed_interventions = sum(1 for i in interventions if i.status == InterventionStatus.COMPLETED)
    intervention_completion_rate = (
        round(completed_interventions / total_interventions * 100, 1) if total_interventions else 0.0
    )

    all_actions = (
        db.query(InterventionAction)
        .join(Intervention, InterventionAction.intervention_id == Intervention.intervention_id)
        .filter(Intervention.mentor_id == mentor_id)
        .all()
    )
    total_actions = len(all_actions)
    completed_actions = sum(1 for a in all_actions if a.is_completed)
    action_completion_rate = round(completed_actions / total_actions * 100, 1) if total_actions else 0.0

    seen_students: set[str] = set()
    mentee_details: list[MenteeMetricOut] = []
    for intv in interventions:
        if intv.student_id in seen_students:
            continue
        seen_students.add(intv.student_id)

        student = db.query(Student).filter(Student.student_id == intv.student_id).first()
        if not student:
            continue

        cutoff = intv.created_at

        before = db.query(RoundResult).filter(
            RoundResult.student_id == intv.student_id,
            RoundResult.attempt_date < cutoff.date(),
        ).all()
        after = db.query(RoundResult).filter(
            RoundResult.student_id == intv.student_id,
            RoundResult.attempt_date >= cutoff.date(),
        ).all()

        passed_before = sum(1 for r in before if r.result == Result.PASSED)
        passed_after = sum(1 for r in after if r.result == Result.PASSED)

        rate_before = (passed_before / len(before)) if before else 0.0
        rate_after = (passed_after / len(after)) if after else 0.0

        got_selected = (
            db.query(StudentDriveRegistration)
            .filter(
                StudentDriveRegistration.student_id == intv.student_id,
                StudentDriveRegistration.final_status == "SELECTED",
            )
            .first()
        ) is not None

        improved = rate_after > rate_before or got_selected

        mentee_details.append(MenteeMetricOut(
            student_id=student.student_id,
            student_name=student.name,
            total_rounds_before=len(before),
            passed_before=passed_before,
            total_rounds_after=len(after),
            passed_after=passed_after,
            improved=improved,
        ))

    mentees_improved = sum(1 for m in mentee_details if m.improved)
    mentees_tracked = len(mentee_details)
    improvement_rate = round(mentees_improved / mentees_tracked * 100, 1) if mentees_tracked else 0.0

    return MentorMetricsOut(
        mentor_id=mentor_id,
        total_interventions=total_interventions,
        completed_interventions=completed_interventions,
        intervention_completion_rate=intervention_completion_rate,
        total_actions=total_actions,
        completed_actions=completed_actions,
        action_completion_rate=action_completion_rate,
        mentees_improved=mentees_improved,
        mentees_tracked=mentees_tracked,
        improvement_rate=improvement_rate,
        mentee_details=mentee_details,
    )


# ── Student Detail ─────────────────────────────────────────────────


@router.get("/{mentor_id}/students/{student_id}/detail", response_model=StudentDetailOut)
def get_student_detail(mentor_id: str, student_id: str, db: Session = Depends(get_db)):
    _get_mentor_or_404(mentor_id, db)
    _assert_mentee(mentor_id, student_id, db)

    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Rounds
    results = db.query(RoundResult).filter(RoundResult.student_id == student_id).all()
    rounds: list[MenteeRoundOut] = []
    for r in results:
        round_obj = db.query(Round).filter(Round.round_id == r.round_id).first()
        drive_obj = db.query(Drive).filter(Drive.drive_id == r.drive_id).first()
        if not round_obj or not drive_obj:
            continue
        rounds.append(MenteeRoundOut(
            drive_id=r.drive_id,
            company_name=drive_obj.company_name,
            role_title=drive_obj.role_title,
            drive_date=drive_obj.drive_date,
            round_number=round_obj.round_number,
            round_name=round_obj.round_name,
            round_type=round_obj.round_type.value,
            result=r.result.value,
            score=r.score,
            max_score=r.max_score,
            rejection_reason=r.rejection_reason,
            feedback=r.feedback,
            weakness_area=r.weakness_area,
            attempt_date=r.attempt_date,
        ))
    rounds.sort(key=lambda x: (x.drive_id, x.round_number))

    # Applications
    registrations = (
        db.query(StudentDriveRegistration)
        .filter(StudentDriveRegistration.student_id == student_id)
        .all()
    )
    applications: list[StudentJobApplicationOut] = []
    for reg in registrations:
        drive = db.query(Drive).filter(Drive.drive_id == reg.drive_id).first()
        if not drive:
            continue
        applications.append(StudentJobApplicationOut(
            drive_id=drive.drive_id,
            company_name=drive.company_name,
            role_title=drive.role_title,
            package_lpa=drive.package_lpa,
            drive_date=drive.drive_date,
            final_status=reg.final_status,
            rounds_cleared=reg.rounds_cleared,
            total_rounds=drive.total_rounds,
        ))

    # Interventions from this mentor
    interventions = (
        db.query(Intervention)
        .filter(Intervention.mentor_id == mentor_id, Intervention.student_id == student_id)
        .order_by(Intervention.created_at.desc())
        .all()
    )
    intv_out: list[MentorInterventionOut] = []
    for intv in interventions:
        intv_out.append(MentorInterventionOut(
            intervention_id=intv.intervention_id,
            student_id=intv.student_id,
            student_name=student.name,
            coordinator_id=intv.coordinator_id,
            trigger_reason=intv.trigger_reason,
            ai_analysis=intv.ai_analysis,
            priority=intv.priority.value,
            status=intv.status.value,
            created_at=intv.created_at,
            updated_at=intv.updated_at,
            actions=[MentorInterventionActionOut.model_validate(a) for a in intv.actions],
        ))

    # Notes
    notes = (
        db.query(MentorNote)
        .filter(MentorNote.mentor_id == mentor_id, MentorNote.student_id == student_id)
        .order_by(MentorNote.created_at.desc())
        .all()
    )

    return StudentDetailOut(
        student_id=student.student_id,
        name=student.name,
        register_number=student.register_number,
        email=student.email,
        department=student.department,
        cgpa=student.cgpa,
        tenth_percentage=student.tenth_percentage,
        twelfth_percentage=student.twelfth_percentage,
        placement_marks=student.placement_marks,
        skills=student.skills,
        resume_path=student.resume_path,
        rounds=rounds,
        applications=applications,
        interventions=intv_out,
        notes=[MentorNoteOut.model_validate(n) for n in notes],
    )


# ── Student Assignment ─────────────────────────────────────────────


@router.post("/{mentor_id}/students", response_model=MenteeOut)
def assign_student(
    mentor_id: str, body: AssignStudentRequest, db: Session = Depends(get_db),
):
    """Assign a student to this mentor."""
    mentor = _get_mentor_or_404(mentor_id, db)

    student = db.query(Student).filter(Student.student_id == body.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = (
        db.query(MentorStudent)
        .filter(MentorStudent.mentor_id == mentor_id, MentorStudent.student_id == body.student_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Student is already assigned to this mentor")

    if mentor.current_mentee_count >= mentor.max_mentees:
        raise HTTPException(status_code=400, detail="Mentor has reached maximum mentee capacity")

    assignment = MentorStudent(mentor_id=mentor_id, student_id=body.student_id)
    db.add(assignment)
    mentor.current_mentee_count += 1
    db.commit()
    db.refresh(assignment)

    return MenteeOut(
        student_id=student.student_id,
        name=student.name,
        register_number=student.register_number,
        department=student.department,
        email=student.email,
        cgpa=student.cgpa,
        placement_marks=student.placement_marks,
        skills=student.skills,
        assigned_at=assignment.assigned_at,
    )


@router.delete("/{mentor_id}/students/{student_id}", status_code=200)
def unassign_student(mentor_id: str, student_id: str, db: Session = Depends(get_db)):
    """Remove a student from this mentor's list."""
    mentor = _get_mentor_or_404(mentor_id, db)

    assignment = (
        db.query(MentorStudent)
        .filter(MentorStudent.mentor_id == mentor_id, MentorStudent.student_id == student_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    db.delete(assignment)
    mentor.current_mentee_count = max(0, mentor.current_mentee_count - 1)
    db.commit()

    return {"message": "Student unassigned successfully"}
