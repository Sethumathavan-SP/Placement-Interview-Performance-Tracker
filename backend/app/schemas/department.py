from pydantic import BaseModel


class DepartmentOverview(BaseModel):
    department: str
    total_students: int
    total_mentors: int
    placed_students: int
    placement_rate: float


class DepartmentStudentOut(BaseModel):
    student_id: str
    name: str
    register_number: str
    email: str
    cgpa: float
    total_drives_applied: int
    drives_selected: int
    rounds_failed: int


class DepartmentMentorOut(BaseModel):
    mentor_id: str
    name: str
    email: str
    specialization: str | None = None
    max_mentees: int
    current_mentee_count: int


class RoundSummaryOut(BaseModel):
    drive_id: str
    company_name: str
    round_name: str
    round_type: str
    round_number: int
    total_appeared: int
    total_passed: int
    total_failed: int
    pass_rate: float


class DepartmentRoundsResponse(BaseModel):
    department: str
    total_drives: int
    rounds: list[RoundSummaryOut]


class FailurePatternOut(BaseModel):
    round_type: str
    total_failures: int
    percentage_of_total: float
    common_weaknesses: list[str]


class DepartmentFailurePatternResponse(BaseModel):
    department: str
    total_students: int
    total_failures: int
    failure_by_round_type: list[FailurePatternOut]
    most_failed_round: str | None = None
    at_risk_count: int


class DepartmentAnalysisOut(BaseModel):
    department: str
    total_students: int
    total_mentors: int
    placed_students: int
    placement_rate: float
    total_failures: int
    most_failed_round: str | None = None
    at_risk_count: int
    avg_cgpa: float


class DepartmentWiseAnalysisResponse(BaseModel):
    total_departments: int
    departments: list[DepartmentAnalysisOut]


class OverallFailurePatternResponse(BaseModel):
    total_students: int
    total_departments: int
    total_failures: int
    failure_by_round_type: list[FailurePatternOut]
    most_failed_round: str | None = None
    at_risk_count: int

