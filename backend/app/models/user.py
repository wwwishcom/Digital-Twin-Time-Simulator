from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(30), nullable=True, unique=True, index=True)

    tasks = relationship("Task", back_populates="user", cascade="all, delete-orphan")
    goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan")
    sent_requests = relationship(
        "Friendship", foreign_keys="Friendship.user_id",
        back_populates="requester", cascade="all, delete-orphan"
    )
    received_requests = relationship(
        "Friendship", foreign_keys="Friendship.friend_id",
        back_populates="recipient", cascade="all, delete-orphan"
    )
    owned_groups = relationship("Group", back_populates="owner", cascade="all, delete-orphan")
    group_memberships = relationship("GroupMember", back_populates="user", cascade="all, delete-orphan")
    log_entries = relationship("LogEntry", back_populates="user", cascade="all, delete-orphan")
    daily_aggregates = relationship("DailyAggregate", back_populates="user", cascade="all, delete-orphan")
    life_scores = relationship("LifeScore", back_populates="user", cascade="all, delete-orphan")
    schedule_drafts = relationship("ScheduleDraft", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    task_comments = relationship("TaskComment", foreign_keys="TaskComment.user_id", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
