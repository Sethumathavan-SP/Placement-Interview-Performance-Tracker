from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class MentorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mentor_id: str
    name: str
    email: str
    department: str
    specialization: str | None = None
    max_mentees: int
    current_mentee_count: int


class MenteeOut(BaseModel):
    student_id: str
    name: str
    register_number: str
    department: str
    email: str
    cgpa: float
    placement_marks: float | None = None
    skills: list | None = None
    assigned_at: datetime


class PlacedMenteeOut(BaseModel):
    student_id: str
    name: str
    register_number: str
    department: str
    cgpa: float
    placed_company: str
    role_title: str
    package_lpa: float


class MentorDashboardOut(BaseModel):
    mentor: MentorOut
    total_mentees: int
    placed_mentees: int
    at_risk_mentees: int
    active_interventions: int
    pending_actions: int


class MenteeRoundOut(BaseModel):
    drive_id: str
    company_name: str
    role_title: str
    drive_date: date
    round_number: int
    round_name: str
    round_type: str
    result: str
    score: float | None = None
    max_score: float | None = None
    rejection_reason: str | None = None
    feedback: str | None = None
    weakness_area: str | None = None
    attempt_date: date


class ViewRoundsResponse(BaseModel):
    student_id: str
    student_name: str
    department: str
    cgpa: float
    total_drives: int
    total_rounds_attempted: int
    rounds_passed: int
    rounds_failed: int
    rounds: list[MenteeRoundOut]


class MentorInterventionActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    action_id: str
    action_type: str
    title: str
    description: str
    target_weakness: str
    resources: list | None = None
    is_completed: bool
    due_date: str | None = None
    completed_at: datetime | None = None
    notes: str | None = None


class MentorInterventionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    intervention_id: str
    student_id: str
    student_name: str | None = None
    coordinator_id: str
    trigger_reason: str
    ai_analysis: str
    priority: str
    status: str
    created_at: datetime
    updated_at: datetime
    actions: list[MentorInterventionActionOut] = []


class MentorInterventionCreate(BaseModel):
    student_id: str
    coordinator_id: str


class ActionProgressUpdate(BaseModel):
    is_completed: bool
    notes: str | None = None


class AssignStudentRequest(BaseModel):
    student_id: str


class MentorNoteCreate(BaseModel):
    content: str


class MentorNoteUpdate(BaseModel):
    content: str


class MentorNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    note_id: str
    mentor_id: str
    student_id: str
    content: str
    created_at: datetime
    updated_at: datetime


class MenteeMetricOut(BaseModel):
    student_id: str
    student_name: str
    total_rounds_before: int
    passed_before: int
    total_rounds_after: int
    passed_after: int
    improved: bool


class MentorMetricsOut(BaseModel):
    mentor_id: str
    total_interventions: int
    completed_interventions: int
    intervention_completion_rate: float
    total_actions: int
    completed_actions: int
    action_completion_rate: float
    mentees_improved: int
    mentees_tracked: int
    improvement_rate: float
    mentee_details: list[MenteeMetricOut]


class StudentJobApplicationOut(BaseModel):
    drive_id: str
    company_name: str
    role_title: str
    package_lpa: float
    drive_date: date
    final_status: str
    rounds_cleared: int
    total_rounds: int


class StudentDetailOut(BaseModel):
    student_id: str
    name: str
    register_number: str
    email: str
    department: str
    cgpa: float
    tenth_percentage: float
    twelfth_percentage: float
    placement_marks: float | None = None
    skills: list | None = None
    resume_path: str | None = None
    rounds: list[MenteeRoundOut]
    applications: list[StudentJobApplicationOut]
    interventions: list[MentorInterventionOut]
    notes: list[MentorNoteOut]
