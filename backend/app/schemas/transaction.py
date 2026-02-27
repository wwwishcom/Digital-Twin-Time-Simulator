from pydantic import BaseModel
from typing import Optional


class TransactionCreate(BaseModel):
    type: str         # income / expense / investment
    date: str         # YYYY-MM-DD
    amount: float
    category: Optional[str] = None
    memo: Optional[str] = None


class TransactionOut(BaseModel):
    id: int
    type: str
    date: str
    amount: float
    category: Optional[str] = None
    memo: Optional[str] = None

    class Config:
        from_attributes = True


class MonthlySummary(BaseModel):
    year: int
    month: int
    total_income: float
    total_expense: float
    total_investment: float
    net_savings: float
    expense_by_category: dict
    income_by_category: dict
