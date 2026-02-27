from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GroupProjectTask(Base):
    __tablename__ = "group_project_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_project_id: Mapped[int] = mapped_column(
        ForeignKey("group_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_to: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    deadline: Mapped[str] = mapped_column(String(20), nullable=True)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    done_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    overdue_recorded: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project = relationship("GroupProject", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assigned_to])
