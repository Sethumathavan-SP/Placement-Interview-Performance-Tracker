import uuid

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Mentor(Base):
    __tablename__ = "mentors"

    mentor_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    department: Mapped[str] = mapped_column(String(50), nullable=False)
    specialization: Mapped[str | None] = mapped_column(String(100), nullable=True)
    max_mentees: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    current_mentee_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    mentee_assignments: Mapped[list["MentorStudent"]] = relationship(back_populates="mentor", cascade="all, delete-orphan")
    interventions: Mapped[list["Intervention"]] = relationship(
        back_populates="mentor",
        foreign_keys="[Intervention.mentor_id]",
    )
