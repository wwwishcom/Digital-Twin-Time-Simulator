from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, inspect

from app.db.session import engine
from app.db.base import Base

from app.api.routes.auth import router as auth_router
from app.api.routes.tasks import router as tasks_router
from app.api.routes.goals import router as goals_router
from app.api.routes.friends import router as friends_router
from app.api.routes.groups import router as groups_router
from app.api.routes.logs import router as logs_router
from app.api.routes.life_scores import router as life_scores_router
from app.api.routes.twinny import router as twinny_router
from app.api.routes.simulation import router as simulation_router
from app.api.routes.plan import router as plan_router
from app.api.routes.transactions import router as transactions_router
from app.api.routes.projects import router as projects_router
from app.api.routes.group_goals import router as group_goals_router
from app.api.routes.group_projects import router as group_projects_router
from app.api.routes.group_stats import router as group_stats_router

# 모델 import (테이블 생성에 필요)
from app.models.user import User  # noqa: F401
from app.models.task import Task  # noqa: F401
from app.models.goal import Goal  # noqa: F401
from app.models.friendship import Friendship  # noqa: F401
from app.models.group import Group, GroupMember  # noqa: F401
from app.models.task_visibility import TaskVisibilityFriend  # noqa: F401
from app.models.log_entry import LogEntry  # noqa: F401
from app.models.daily_aggregate import DailyAggregate  # noqa: F401
from app.models.life_score import LifeScore  # noqa: F401
from app.models.schedule_draft import ScheduleDraft  # noqa: F401
from app.models.transaction import Transaction  # noqa: F401
from app.models.task_comment import TaskComment  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.project_task import ProjectTask  # noqa: F401
from app.models.group_goal import GroupGoal  # noqa: F401
from app.models.group_project import GroupProject  # noqa: F401
from app.models.group_project_task import GroupProjectTask  # noqa: F401

app = FastAPI(title="Time Twin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _run_migrations():
    """기존 테이블에 새 컬럼 추가 (없을 경우에만)"""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    with engine.connect() as conn:
        # users 테이블에 nickname 컬럼 추가
        if "users" in existing_tables:
            cols = [c["name"] for c in inspector.get_columns("users")]
            if "nickname" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN nickname VARCHAR(30)"))
                conn.commit()

        # tasks 테이블에 visibility 컬럼 추가
        if "tasks" in existing_tables:
            cols = [c["name"] for c in inspector.get_columns("tasks")]
            if "visibility" not in cols:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN visibility VARCHAR(10) NOT NULL DEFAULT 'private'"))
                conn.commit()
            if "shared_from_task_id" not in cols:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN shared_from_task_id INTEGER REFERENCES tasks(id)"))
                conn.commit()

        # project_tasks 테이블에 memo, deadline 컬럼 추가
        if "project_tasks" in existing_tables:
            cols = [c["name"] for c in inspector.get_columns("project_tasks")]
            if "memo" not in cols:
                conn.execute(text("ALTER TABLE project_tasks ADD COLUMN memo TEXT"))
                conn.commit()
            if "deadline" not in cols:
                conn.execute(text("ALTER TABLE project_tasks ADD COLUMN deadline VARCHAR(10)"))
                conn.commit()


_run_migrations()
Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(goals_router)
app.include_router(friends_router)
app.include_router(groups_router)
app.include_router(logs_router)
app.include_router(life_scores_router)
app.include_router(twinny_router)
app.include_router(simulation_router)
app.include_router(plan_router)
app.include_router(transactions_router)
app.include_router(projects_router)
app.include_router(group_goals_router)
app.include_router(group_projects_router)
app.include_router(group_stats_router)
