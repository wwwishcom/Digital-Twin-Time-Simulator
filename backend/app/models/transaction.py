from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class Transaction(Base):
    """가계부 트랜잭션 — 소비/소득/투자 기록"""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # income / expense / investment
    type = Column(String(20), nullable=False, index=True)

    # 날짜 (YYYY-MM-DD)
    date = Column(String(10), nullable=False, index=True)

    amount = Column(Float, nullable=False)

    # 소비: 식비/교통/쇼핑/의료/문화/교육/통신/기타
    # 소득: 월급/용돈/알바/부업/기타
    # 투자: 주식/암호화폐/펀드/저금/기타
    category = Column(String(50), nullable=True)

    memo = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="transactions")
