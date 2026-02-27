from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionOut, MonthlySummary

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    year: Optional[int] = None,
    month: Optional[int] = None,
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if date:
        q = q.filter(Transaction.date == date)
    elif year and month:
        prefix = f"{year:04d}-{month:02d}"
        q = q.filter(Transaction.date.like(f"{prefix}%"))
    q = q.order_by(Transaction.date.desc(), Transaction.id.desc())
    return q.all()


@router.post("", response_model=TransactionOut)
def create_transaction(
    body: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.type not in ("income", "expense", "investment"):
        raise HTTPException(status_code=400, detail="type은 income/expense/investment 중 하나여야 합니다.")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="금액은 0보다 커야 합니다.")
    tx = Transaction(
        user_id=current_user.id,
        type=body.type,
        date=body.date,
        amount=body.amount,
        category=body.category,
        memo=body.memo,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tx = db.query(Transaction).filter(Transaction.id == tx_id, Transaction.user_id == current_user.id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="트랜잭션을 찾을 수 없습니다.")
    db.delete(tx)
    db.commit()


@router.get("/summary", response_model=MonthlySummary)
def monthly_summary(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefix = f"{year:04d}-{month:02d}"
    txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id, Transaction.date.like(f"{prefix}%"))
        .all()
    )

    total_income = sum(t.amount for t in txs if t.type == "income")
    total_expense = sum(t.amount for t in txs if t.type == "expense")
    total_investment = sum(t.amount for t in txs if t.type == "investment")

    expense_by_cat: dict = {}
    for t in txs:
        if t.type == "expense":
            cat = t.category or "기타"
            expense_by_cat[cat] = expense_by_cat.get(cat, 0) + t.amount

    income_by_cat: dict = {}
    for t in txs:
        if t.type == "income":
            cat = t.category or "기타"
            income_by_cat[cat] = income_by_cat.get(cat, 0) + t.amount

    return MonthlySummary(
        year=year,
        month=month,
        total_income=total_income,
        total_expense=total_expense,
        total_investment=total_investment,
        net_savings=total_income - total_expense - total_investment,
        expense_by_category=expense_by_cat,
        income_by_category=income_by_cat,
    )
