# Добавьте эти импорты в начало файла app/api/routes/call_routes.py
# Добавьте или замените импорты в начале файла app/api/routes/call_routes.py

import os
import shutil
import uuid
import json
import time
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, Depends
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional
from app.models.schemas import CallUpload, CallAnalysisResult, CallListItem
from app.services.transcription_service import transcribe_audio
from app.services.analysis_service import analyze_transcript
from app.utils.file_utils import get_audio_duration, save_json, load_json, get_all_analysis_files
# Добавьте следующие импорты в начало файла call_routes.py если они отсутствуют
from pydantic import BaseModel
from typing import List, Optional, Dict

# Добавьте модели данных для комментариев
class Comment(BaseModel):
    """Модель комментария к звонку"""
    id: str
    text: str
    comment: str
    type: str  # 'good', 'bad', 'note'
    created_at: str

class CallComments(BaseModel):
    """Список комментариев к звонку"""
    call_id: str
    comments: List[Comment]


# Модели для комментариев
class MomentComment(BaseModel):
    text: str
    comment: str
    added_by_user: bool = True
    add_to_training: bool = False

class CallComments(BaseModel):
    best_moments: List[MomentComment] = []
    worst_moments: List[MomentComment] = []
    general_comment: Optional[str] = None



# Импортируйте функцию log_progress или добавьте её определение
def log_progress(call_id: str, message: str, step: Optional[str] = None):
    """
    Записывает сообщение о прогрессе в файл логов
    
    Args:
        call_id (str): ID звонка
        message (str): Сообщение о прогрессе
        step (str, optional): Текущий этап обработки
    """
    # Получаем директорию для результатов из переменных окружения
    results_dir = os.getenv("RESULTS_DIR", "app/static/results")
    
    # Путь к файлу прогресса
    progress_file = os.path.join(results_dir, f"{call_id}_progress.json")
    
    try:
        # Загружаем текущий прогресс, если файл существует
        current_progress = {}
        if os.path.exists(progress_file):
            with open(progress_file, 'r', encoding='utf-8') as f:
                current_progress = json.load(f)
        
        # Инициализируем списки и значения, если их нет
        if "messages" not in current_progress:
            current_progress["messages"] = []
        if "start_time" not in current_progress:
            current_progress["start_time"] = time.time()
        
        # Текущее время и прошедшее время
        current_time = time.time()
        elapsed = current_time - current_progress.get("start_time", current_time)
        
        # Создаем новую запись
        log_entry = {
            "timestamp": current_time,
            "elapsed_seconds": round(elapsed, 2),
            "message": message
        }
        
        if step:
            log_entry["step"] = step
            current_progress["current_step"] = step
        
        # Добавляем запись в список сообщений
        current_progress["messages"].append(log_entry)
        
        # Обновляем текущее сообщение
        current_progress["current_message"] = message
        current_progress["last_update"] = current_time
        
        # Записываем обновленный прогресс в файл
        with open(progress_file, 'w', encoding='utf-8') as f:
            json.dump(current_progress, f, ensure_ascii=False, indent=2)
            
    except Exception as e:
        print(f"Ошибка при записи прогресса: {str(e)}")

router = APIRouter()

# Оставьте остальную часть файла без изменений

@router.post("/calls/upload")
async def upload_call(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    call_data: Optional[str] = Form(None)
):
    """Загружает аудиофайл звонка и запускает его анализ"""
    try:
        # Создаем уникальный ID для звонка
        call_id = f"call_{uuid.uuid4().hex}"
        
        # Определяем расширение файла
        file_ext = os.path.splitext(file.filename)[1]
        file_name = f"{call_id}{file_ext}"
        file_path = os.path.join(os.getenv("UPLOAD_DIR"), file_name)
        
        # Сохраняем файл
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Запускаем процесс анализа в фоновом режиме
        background_tasks.add_task(
            process_call, 
            file_path, 
            call_id, 
            file.filename,
            call_data
        )
        
        return {
            "status": "success",
            "message": "Файл успешно загружен, анализ запущен",
            "call_id": call_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке файла: {str(e)}")

@router.get("/calls/status/{call_id}")
async def get_call_status(call_id: str):
    """Проверяет статус анализа звонка"""
    result_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}.json")
    
    if os.path.exists(result_path):
        return {"status": "completed"}
    else:
        # Здесь можно проверить, находится ли звонок в процессе обработки
        # Например, создавая временный файл со статусом
        processing_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_processing")
        if os.path.exists(processing_path):
            return {"status": "processing"}
        else:
            raise HTTPException(status_code=404, detail="Анализ не найден")

@router.get("/calls/result/{call_id}")
async def get_call_result(call_id: str):
    """Возвращает результат анализа звонка"""
    result_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}.json")
    
    if os.path.exists(result_path):
        result = load_json(result_path)
        return result
    else:
        raise HTTPException(status_code=404, detail="Результат анализа не найден")

@router.get("/calls", response_model=List[CallListItem])
async def list_calls():
    """Возвращает список всех проанализированных звонков"""
    analysis_files = get_all_analysis_files(os.getenv("RESULTS_DIR"))
    calls = []
    
    for file_path in analysis_files:
        try:
            analysis = load_json(file_path)
            calls.append(CallListItem(
                call_id=analysis["call_id"],
                created_at=datetime.fromisoformat(analysis["created_at"]),
                agent_name=analysis.get("metadata", {}).get("agent_name"),
                duration=analysis.get("duration"),
                overall_score=analysis["score"]["overall"],
                file_name=os.path.basename(analysis["file_path"])
            ))
        except Exception as e:
            # Пропускаем файлы с ошибками
            continue
    
    # Сортируем звонки по дате (новые сначала)
    calls.sort(key=lambda x: x.created_at, reverse=True)
    return calls

@router.delete("/calls/{call_id}")
async def delete_call(call_id: str):
    """Удаляет звонок и его анализ"""
    result_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}.json")
    
    if os.path.exists(result_path):
        # Загружаем данные, чтобы получить путь к файлу
        analysis = load_json(result_path)
        file_path = analysis.get("file_path")
        
        # Удаляем файл анализа
        os.remove(result_path)
        
        # Удаляем аудиофайл, если он существует
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            
        return {"status": "success", "message": "Звонок успешно удален"}
    else:
        raise HTTPException(status_code=404, detail="Звонок не найден")

async def process_call(file_path: str, call_id: str, original_filename: str, call_data: Optional[str] = None):
    """Обрабатывает звонок: транскрибирует и анализирует с отслеживанием прогресса"""
    processing_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_processing")
    
    try:
        # Создаем файл-маркер, что звонок в обработке
        with open(processing_path, "w") as f:
            f.write("processing")
        
        # Создаем начальный файл прогресса
        progress_file = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_progress.json")
        initial_progress = {
            "call_id": call_id,
            "start_time": time.time(),
            "current_step": "initialization",
            "current_message": "Начало обработки звонка",
            "messages": [{
                "timestamp": time.time(),
                "message": "Процесс анализа запущен",
                "step": "initialization"
            }]
        }
        with open(progress_file, 'w', encoding='utf-8') as f:
            json.dump(initial_progress, f, ensure_ascii=False, indent=2)
        
        # Подготавливаем метаданные
        log_progress(call_id, "Обработка файла и подготовка данных", "file_processing")
        metadata = {}
        if call_data:
            metadata = json.loads(call_data)
            log_progress(call_id, f"Получены метаданные: {metadata.get('agent_name', 'Неизвестный')}")
        
        # Получаем длительность аудио
        log_progress(call_id, "Определение длительности аудио...")
        duration = get_audio_duration(file_path)
        log_progress(call_id, f"Длительность аудио: {duration:.2f} секунд")
        
        # Транскрибируем аудио
        transcript = await transcribe_audio(file_path, call_id)
        
        # Анализируем транскрипцию
        analysis, score, best_moments, worst_moments, recommendations = await analyze_transcript(transcript, call_id)
        
        # Создаем результат анализа
        log_progress(call_id, "Формирование итогового отчета", "finalizing")
        result = CallAnalysisResult(
            call_id=call_id,
            file_path=file_path,
            duration=duration,
            transcript=transcript,
            analysis=analysis,
            score=score,
            best_moments=best_moments,
            worst_moments=worst_moments,
            recommendations=recommendations,
            metadata={
                "original_filename": original_filename,
                **metadata
            }
        )
        
        # Сохраняем результат в JSON
        result_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}.json")
        save_json(result_path, result.dict())
        log_progress(call_id, "Анализ успешно завершен", "completed")

        
        # Удаляем файл-маркер обработки
        if os.path.exists(processing_path):
            os.remove(processing_path)
            
    except Exception as e:
        # Логируем ошибку
        error_msg = f"Ошибка при обработке звонка: {str(e)}"
        log_progress(call_id, error_msg, "error")
        
        import traceback
        with open(os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_error.log"), "w") as f:
            f.write(f"Error: {str(e)}\n")
            f.write(traceback.format_exc())
        
        # Удаляем файл-маркер обработки
        if os.path.exists(processing_path):
            os.remove(processing_path)


@router.get("/calls/progress/{call_id}")
async def get_call_progress_status(call_id: str):
    """Возвращает информацию о текущем прогрессе анализа звонка"""
    result_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}.json")
    progress_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_progress.json")
    error_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_error.log")
    processing_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_processing")
    
    # Проверяем, завершен ли анализ
    if os.path.exists(result_path):
        return {
            "status": "completed",
            "progress": 100,
            "message": "Анализ успешно завершен",
            "logs": ["Анализ успешно завершен"]
        }
    
    # Проверяем наличие лог-файла с прогрессом
    if os.path.exists(progress_path):
        try:
            progress_data = load_json(progress_path)
            
            # Вычисляем примерный процент выполнения
            progress_percent = 0
            current_step = progress_data.get("current_step", "")
            
            # Примерная оценка прогресса по этапам
            step_percentages = {
                "initialization": 0,
                "file_processing": 10,
                "transcription_start": 20,
                "transcription": 40,
                "analysis_start": 50,
                "analysis": 80,
                "finalizing": 90,
                "completed": 100,
                "error": 0
            }
            
            if current_step in step_percentages:
                progress_percent = step_percentages[current_step]
            
            # Извлекаем историю сообщений
            logs = []
            for msg in progress_data.get("messages", []):
                timestamp = datetime.fromtimestamp(msg.get("timestamp", 0)).strftime("%H:%M:%S")
                logs.append(f"[{timestamp}] {msg.get('message', '')}")
                
            return {
                "status": "processing",
                "progress": progress_percent,
                "message": progress_data.get("current_message", "Обработка в процессе..."),
                "current_step": current_step,
                "logs": logs
            }
        except Exception as e:
            print(f"Ошибка при чтении файла прогресса: {str(e)}")
    
    # Проверяем, не произошла ли ошибка
    if os.path.exists(error_path):
        try:
            with open(error_path, 'r', encoding='utf-8') as f:
                error_text = f.read()
            return {
                "status": "error",
                "progress": 0,
                "message": f"Ошибка при анализе: {error_text[:100]}...",
                "logs": [f"Ошибка: {error_text[:500]}..."]
            }
        except Exception as e:
            print(f"Ошибка при чтении файла ошибки: {str(e)}")
    
    # Проверяем, находится ли звонок в обработке
    if os.path.exists(processing_path):
        return {
            "status": "waiting",
            "progress": 5,
            "message": "Ожидание начала обработки...",
            "logs": ["Файл загружен, ожидание начала анализа"]
        }
    
    # Если ничего не найдено
    return {
        "status": "not_found",
        "progress": 0,
        "message": "Звонок не найден",
        "logs": []
    }


@router.get("/calls/comments/{call_id}")
async def get_call_comments(call_id: str):
    """Возвращает комментарии к звонку"""
    comments_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_comments.json")
    
    if not os.path.exists(comments_path):
        # Если файла с комментариями нет, возвращаем пустой список
        return {"call_id": call_id, "comments": []}
    
    # Загружаем комментарии
    comments = load_json(comments_path)
    return comments

@router.post("/calls/comments/{call_id}")
async def add_call_comment(call_id: str, comment: Comment):
    """Добавляет комментарий к звонку"""
    comments_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_comments.json")
    
    # Загружаем существующие комментарии или создаем новый список
    if os.path.exists(comments_path):
        call_comments = load_json(comments_path)
        comments = call_comments.get("comments", [])
    else:
        comments = []
    
    # Добавляем новый комментарий
    comments.append(comment.dict())
    
    # Сохраняем обновленный список комментариев
    call_comments = {"call_id": call_id, "comments": comments}
    save_json(comments_path, call_comments)
    
    return {"status": "success", "comment_id": comment.id}

@router.delete("/calls/comments/{call_id}/{comment_id}")
async def delete_call_comment(call_id: str, comment_id: str):
    """Удаляет комментарий к звонку"""
    comments_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_comments.json")
    
    if not os.path.exists(comments_path):
        raise HTTPException(status_code=404, detail="Комментарии не найдены")
    
    # Загружаем комментарии
    call_comments = load_json(comments_path)
    comments = call_comments.get("comments", [])
    
    # Удаляем комментарий по ID
    updated_comments = [c for c in comments if c.get("id") != comment_id]
    
    # Если ничего не изменилось, значит комментарий не найден
    if len(updated_comments) == len(comments):
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    
    # Сохраняем обновленный список комментариев
    call_comments["comments"] = updated_comments
    save_json(comments_path, call_comments)
    
    return {"status": "success", "message": "Комментарий успешно удален"}

@router.post("/calls/cancel/{call_id}")
async def cancel_call_analysis(call_id: str):
    """Отменяет процесс анализа звонка"""
    progress_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_progress.json")
    processing_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_processing")
    
    # Проверяем, существует ли процесс анализа
    if not os.path.exists(processing_path):
        raise HTTPException(status_code=404, detail="Анализ не найден или уже завершен")
    
    try:
        # Создаем отметку об отмене
        log_progress(call_id, "Анализ отменен пользователем", "cancelled")
        
        # Удаляем файл-маркер обработки
        if os.path.exists(processing_path):
            os.remove(processing_path)
            
        # Можно добавить дополнительную логику для остановки фоновых задач,
        # если это необходимо
        
        return {"status": "success", "message": "Анализ успешно отменен"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при отмене анализа: {str(e)}")