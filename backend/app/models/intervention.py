import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.enums import InterventionStatus, Priority


class Intervention(Base):
    __tablename__ = "interventions"

    intervention_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.student_id"), nullable=False)
    coordinator_id: Mapped[str] = mapped_column(String(36), ForeignKey("coordinators.coordinator_id"), nullable=False)
    mentor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("mentors.mentor_id"), nullable=True)
    trigger_reason: Mapped[str] = mapped_column(Text, nullable=False)
    failure_summary: Mapped[dict] = mapped_column(JSON, nullable=False)
    ai_analysis: Mapped[str] = mapped_column(Text, nullable=False)
    recommendations: Mapped[list] = mapped_column(JSON, nullable=False)
    priority: Mapped[Priority] = mapped_column(nullable=False)
    status: Mapped[InterventionStatus] = mapped_column(nullable=False, default=InterventionStatus.GENERATED)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    student: Mapped["Student"] = relationship(back_populates="interventions")
    coordinator: Mapped["Coordinator"] = relationship(back_populates="interventions")
    mentor: Mapped["Mentor | None"] = relationship(back_populates="interventions", foreign_keys=[mentor_id])
    actions: Mapped[list["InterventionAction"]] = relationship(back_populates="intervention", cascade="all, delete-orphan")
