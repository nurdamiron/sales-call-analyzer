from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from datetime import datetime

class CallUpload(BaseModel):
    """Схема загрузки звонка"""
    call_name: Optional[str] = None
    agent_name: Optional[str] = None
    client_id: Optional[str] = None
    notes: Optional[str] = None

class ScoreItem(BaseModel):
    """Оценка по отдельному критерию"""
    score: float = Field(..., ge=0, le=10)
    comment: Optional[str] = None

class CallScore(BaseModel):
    """Оценки по всем критериям"""
    script_adherence: ScoreItem
    active_listening: ScoreItem
    objection_handling: ScoreItem
    sales_techniques: ScoreItem
    communication_ethics: ScoreItem
    overall: float = Field(..., ge=0, le=10)

class Moment(BaseModel):
    """Важный момент в разговоре"""
    time_start: Optional[float] = None  # Время начала момента в секундах
    time_end: Optional[float] = None    # Время конца момента в секундах
    text: str                           # Текст момента
    comment: str                        # Комментарий к моменту

class CallAnalysisResult(BaseModel):
    """Результат анализа звонка"""
    call_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    file_path: str
    duration: Optional[float] = None
    transcript: str
    analysis: Dict[str, str]  # Анализ по этапам разговора
    score: CallScore
    best_moments: List[Moment]
    worst_moments: List[Moment]
    recommendations: List[str]
    metadata: Optional[Dict] = None

class CallListItem(BaseModel):
    """Элемент списка звонков"""
    call_id: str
    created_at: datetime
    agent_name: Optional[str] = None
    duration: Optional[float] = None
    overall_score: float
    file_name: str