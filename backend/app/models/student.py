"""Dummy model — replace when Team A builds the real Student entity."""
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Student(Base):
    __tablename__ = "students"

    student_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    register_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    department: Mapped[str] = mapped_column(String(50), nullable=False)
    cgpa: Mapped[float] = mapped_column(Float, nullable=False)
    tenth_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    twelfth_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    placement_marks: Mapped[float | None] = mapped_column(Float, nullable=True)
    skills: Mapped[list | None] = mapped_column(JSON, nullable=True)
    resume_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("status.status_id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    round_results: Mapped[list["RoundResult"]] = relationship(back_populates="student")
    registrations: Mapped[list["StudentDriveRegistration"]] = relationship(back_populates="student")
    interventions: Mapped[list["Intervention"]] = relationship(back_populates="student")
    status: Mapped["Status"] = relationship()
    mentor_assignments: Mapped[list["MentorStudent"]] = relationship(back_populates="student")
