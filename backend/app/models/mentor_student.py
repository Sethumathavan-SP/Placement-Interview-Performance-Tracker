import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MentorStudent(Base):
    __tablename__ = "mentor_students"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mentor_id: Mapped[str] = mapped_column(String(36), ForeignKey("mentors.mentor_id"), nullable=False)
    student_id: Mapped[str] = mapped_column(String(36), ForeignKey("students.student_id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    mentor: Mapped["Mentor"] = relationship(back_populates="mentee_assignments")
    student: Mapped["Student"] = relationship(back_populates="mentor_assignments")
