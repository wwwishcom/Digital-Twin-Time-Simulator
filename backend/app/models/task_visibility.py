from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TaskVisibilityFriend(Base):
    __tablename__ = "task_visibility_friends"
    __table_args__ = (
        UniqueConstraint("task_id", "friend_user_id", name="uq_task_visibility"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    friend_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
