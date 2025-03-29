# В app/models/schemas.py
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Union
from datetime import datetime

class CallUpload(BaseModel):
    """Схема загрузки звонка"""
    call_name: Optional[str] = None
    agent_name: Optional[str] = None
    client_id: Optional[str] = None
    notes: Optional[str] = None
    language: Optional[str] = "auto"  # Добавляем поле языка

class ScoreItem(BaseModel):
    """Оценка по отдельному критерию"""
    score: Union[float, None] = Field(..., description="Оценка от 0 до 10 или None если критерий не применим")
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
    recommendation: Optional[str] = None  # Рекомендация по улучшению (для проблемных моментов)

class UtteranceItem(BaseModel):
    """Реплика в диалоге"""
    speaker: str  # 'seller' или 'client'
    text: str

class CallAnalysisResult(BaseModel):
    """Результат анализа звонка"""
    call_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    file_path: str
    duration: Optional[float] = None
    transcript: str
    dialogue: Optional[List[UtteranceItem]] = None  # Диалог с разделением на реплики
    # Важное изменение: разрешаем None значения в словаре
    analysis: Dict[str, Optional[str]]  # Анализ по этапам разговора
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
    language: Optional[str] = "ru"  # Добавляем язык звонка

class Comment(BaseModel):
    """Модель комментария к звонку"""
    id: str
    text: str
    comment: str
    type: str  # 'good', 'bad', 'note'
    created_at: str
    recommendation: Optional[str] = None  # Добавляем рекомендацию к комментарию

class CallProgress(BaseModel):
    """Прогресс обработки звонка"""
    call_id: str
    status: str  # 'waiting', 'processing', 'completed', 'error'
    progress: int  # процент выполнения 0-100
    current_step: Optional[str] = None
    current_message: Optional[str] = None
    start_time: float
    last_update: Optional[float] = None
    messages: List[Dict]
    detected_language: Optional[str] = None  # Добавляем определенный язык