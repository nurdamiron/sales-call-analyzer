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
from app.services.transcription_service import transcribe_audio_advanced
from app.services.analysis_service import analyze_transcript
from app.utils.file_utils import get_audio_duration, save_json, load_json, get_all_analysis_files
# Добавьте следующие импорты в начало файла call_routes.py если они отсутствуют
from pydantic import BaseModel
from typing import List, Optional, Dict
from app.services.dialogue_service import DialogueSplitter
dialogue_splitter = DialogueSplitter()

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
            # Убедитесь, что это не файл прогресса
            if "_progress" in file_path or "_error" in file_path:
                continue
                
            analysis = load_json(file_path)
            
            # Проверяем наличие обязательных полей
            if not analysis.get("call_id"):
                print(f"Пропускаем файл без call_id: {file_path}")
                continue
                
            # Получаем created_at или используем текущее время
            created_at = datetime.now()
            try:
                if analysis.get("created_at"):
                    created_at = datetime.fromisoformat(analysis["created_at"])
            except (ValueError, TypeError):
                print(f"Неверный формат даты в {file_path}, используем текущую дату")
            
            # Получаем метаданные, если они есть
            metadata = analysis.get("metadata", {}) or {}
            
            calls.append(CallListItem(
                call_id=analysis.get("call_id", ""),
                created_at=created_at,
                agent_name=metadata.get("agent_name", ""),
                duration=analysis.get("duration", 0),
                overall_score=analysis.get("score", {}).get("overall", 0),
                file_name=os.path.basename(analysis.get("file_path", "unknown"))
            ))
        except Exception as e:
            print(f"Ошибка при обработке файла {file_path}: {str(e)}")
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
        # Создаем файл-маркер
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
        
        # Определяем длительность аудио
        log_progress(call_id, "Определение длительности аудио...")
        duration = get_audio_duration(file_path)
        log_progress(call_id, f"Длительность аудио: {duration:.2f} секунд")
        
        # Транскрибируем аудио с продвинутой обработкой
        transcript = await transcribe_audio_advanced(file_path, call_id)
        
        # Обнаруживаем язык из транскрипции, если он не определен ранее
        if "detected_language" not in metadata or not metadata["detected_language"]:
            # Простой подход к определению языка из текста
            # Можно заменить на более сложный алгоритм
            kz_chars = set("ңғәіңөұқ")
            if any(char in kz_chars for char in transcript.lower()):
                language = "kk"
            else:
                language = "ru"
            metadata["detected_language"] = language
            log_progress(call_id, f"Определен язык из текста: {language}")
        else:
            language = metadata["detected_language"]
        
        # Анализ с учетом языка
        log_progress(call_id, "Анализ транскрипции звонка...", "analysis")
        analysis, score, best_moments, worst_moments, recommendations = await analyze_transcript(
            transcript, call_id, language
        )
        
        # Проверяем анализ на наличие None значений и заменяем их строками
        for key in analysis:
            if analysis[key] is None:
                log_progress(call_id, f"Заменяем None значение для {key} на строку 'Не применимо'", "analysis", "debug")
                analysis[key] = "Не применимо"
        
        # Убеждаемся, что все необходимые ключи присутствуют в анализе
        required_keys = ["greeting", "needs_identification", "presentation", "objection_handling", "closing"]
        for key in required_keys:
            if key not in analysis:
                log_progress(call_id, f"Добавляем отсутствующий ключ {key} в анализ", "analysis", "debug")
                analysis[key] = "Не удалось проанализировать"
        
        # Проверка моментов
        if not best_moments:
            log_progress(call_id, "Лучшие моменты не выделены, используем заглушку", "analysis", "warning")
            best_moments = [{"text": "Не удалось выделить", "comment": "Анализатор не смог найти выраженно положительные моменты"}]
        
        if not worst_moments:
            log_progress(call_id, "Худшие моменты не выделены, используем заглушку", "analysis", "warning")
            worst_moments = [{"text": "Не удалось выделить", "comment": "Анализатор не смог найти выраженно проблемные моменты"}]
        
        # Проверяем, что у всех моментов есть необходимые поля
        for moment in best_moments + worst_moments:
            if "text" not in moment:
                moment["text"] = "Не удалось выделить"
            if "comment" not in moment:
                moment["comment"] = "Без комментария"
            if "recommendation" not in moment and moment in worst_moments:
                moment["recommendation"] = "Нет конкретных рекомендаций"
        
        # Разделение диалога на реплики
        log_progress(call_id, "Разделение диалога на реплики", "dialogue_splitting")
        dialogue = dialogue_splitter.split_dialogue(transcript, language)
        
        try:
            # Создаем результат анализа
            log_progress(call_id, "Формирование итогового отчета", "finalizing")
            
            result = CallAnalysisResult(
                call_id=call_id,
                file_path=file_path,
                duration=duration,
                transcript=transcript,
                dialogue=dialogue,
                analysis=analysis,
                score=score,
                best_moments=best_moments,
                worst_moments=worst_moments,
                recommendations=recommendations,
                metadata={
                    "original_filename": original_filename,
                    "language": language,
                    **(metadata or {})
                }
            )
            
            # Сохраняем результат в JSON
            result_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}.json")
            save_json(result_path, result.dict())
            log_progress(call_id, "Анализ успешно завершен", "completed")
            
        except Exception as validation_error:
            # Логируем детали ошибки валидации
            error_msg = f"Ошибка при создании CallAnalysisResult: {str(validation_error)}"
            log_progress(call_id, error_msg, "error", "error")
            
            # Сохраняем проблемные данные для отладки
            debug_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_debug.json")
            debug_data = {
                "transcript": transcript[:1000] + "...", # Первые 1000 символов
                "analysis": analysis,
                "score": score,
                "best_moments": best_moments,
                "worst_moments": worst_moments,
                "validation_error": str(validation_error)
            }
            save_json(debug_path, debug_data)
            
            # Повторная попытка со всеми исправлениями
            log_progress(call_id, "Попытка исправить данные и повторить сохранение", "fixing", "warning")
            
            # Исправляем все возможные проблемы с данными
            # 1. Еще раз проверяем все словари analysis на наличие None
            for key in list(analysis.keys()):
                if analysis[key] is None:
                    analysis[key] = "Не удалось проанализировать после исправления"
            
            # 2. Проверяем структуру score
            if not isinstance(score, dict):
                score = {
                    "script_adherence": {"score": 5.0, "comment": "Автоматическая оценка после исправления"},
                    "active_listening": {"score": 5.0, "comment": "Автоматическая оценка после исправления"},
                    "objection_handling": {"score": 5.0, "comment": "Автоматическая оценка после исправления"},
                    "sales_techniques": {"score": 5.0, "comment": "Автоматическая оценка после исправления"},
                    "communication_ethics": {"score": 5.0, "comment": "Автоматическая оценка после исправления"},
                    "overall": 5.0
                }
            else:
                # Проверяем наличие всех требуемых полей
                required_score_keys = ["script_adherence", "active_listening", "objection_handling", 
                                      "sales_techniques", "communication_ethics", "overall"]
                
                for key in required_score_keys:
                    if key not in score:
                        if key == "overall":
                            score[key] = 5.0
                        else:
                            score[key] = {"score": 5.0, "comment": "Добавлено после исправления"}
                    elif key != "overall" and not isinstance(score[key], dict):
                        score[key] = {"score": 5.0, "comment": "Исправлено после ошибки валидации"}
            
            # 3. Проверяем структуру моментов
            for i, moment in enumerate(best_moments):
                if not isinstance(moment, dict):
                    best_moments[i] = {"text": "Исправлено после ошибки", "comment": "Автоматическое исправление"}
            
            for i, moment in enumerate(worst_moments):
                if not isinstance(moment, dict):
                    worst_moments[i] = {
                        "text": "Исправлено после ошибки", 
                        "comment": "Автоматическое исправление",
                        "recommendation": "Добавлено после исправления"
                    }
            
            # Проверяем что моменты не пустые
            if not best_moments:
                best_moments = [{"text": "Автоматически добавлено", "comment": "Нет данных после исправления"}]
            
            if not worst_moments:
                worst_moments = [{"text": "Автоматически добавлено", "comment": "Нет данных после исправления", 
                                 "recommendation": "Автоматически добавлено"}]
            
            # Повторная попытка создания объекта и сохранения
            try:
                # Создаем новый объект после исправлений
                result = CallAnalysisResult(
                    call_id=call_id,
                    file_path=file_path,
                    duration=duration,
                    transcript=transcript,
                    dialogue=dialogue,
                    analysis=analysis,
                    score=score,
                    best_moments=best_moments,
                    worst_moments=worst_moments,
                    recommendations=recommendations or ["Повторите анализ для получения рекомендаций"],
                    metadata={
                        "original_filename": original_filename,
                        "language": language,
                        "fixed_after_validation_error": True,
                        **(metadata or {})
                    }
                )
                
                # Сохраняем исправленный результат
                result_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}.json")
                save_json(result_path, result.dict())
                log_progress(call_id, "Анализ завершен после исправления ошибок", "completed")
                
            except Exception as second_error:
                # Если и после исправлений не получилось, логируем окончательную ошибку
                final_error_msg = f"Не удалось сохранить результат даже после исправлений: {str(second_error)}"
                log_progress(call_id, final_error_msg, "error", "error")
                raise Exception(final_error_msg)
        
        # Удаляем файл-маркер обработки
        if os.path.exists(processing_path):
            os.remove(processing_path)
            
    except Exception as e:
        # Логируем ошибку
        error_msg = f"Ошибка при обработке звонка: {str(e)}"
        log_progress(call_id, error_msg, "error", "error")
        
        import traceback
        with open(os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_error.log"), "w") as f:
            f.write(f"Error: {str(e)}\n")
            f.write(traceback.format_exc())
        
        # Удаляем файл-маркер обработки
        if os.path.exists(processing_path):
            os.remove(processing_path)

@router.get("/calls/progress/{call_id}")
async def get_call_progress_status(call_id: str):
    """Проверяет статус анализа звонка"""
    progress_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_progress.json")
    error_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_error.log")
    result_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}.json")
    processing_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_processing")
    
    try:
        # Проверяем, завершен ли анализ
        if os.path.exists(result_path):
            return {"status": "completed", "progress": 100, "message": "Анализ успешно завершен"}
        
        # Проверяем, не произошла ли ошибка
        if os.path.exists(error_path):
            try:
                with open(error_path, 'r', encoding='utf-8') as f:
                    error_text = f.read(500)  # Читаем первые 500 символов
                return {
                    "status": "error",
                    "progress": 0,
                    "message": f"Ошибка при анализе: {error_text}...",
                    "logs": [f"Ошибка: {error_text}..."]
                }
            except Exception:
                return {"status": "error", "progress": 0, "message": "Неизвестная ошибка при анализе"}
        
        # Проверяем файл прогресса
        if os.path.exists(progress_path):
            try:
                with open(progress_path, 'r', encoding='utf-8') as f:
                    progress_data = json.load(f)
                
                # Определяем процент выполнения по шагу
                current_step = progress_data.get("current_step", "initialization")
                step_percentages = {
                    "initialization": 5,
                    "file_processing": 10,
                    "transcription_start": 20,
                    "transcription": 40,
                    "language_detection": 30,
                    "transcription_complete": 50, 
                    "analysis_start": 60,
                    "analysis": 80,
                    "dialogue_splitting": 85,
                    "finalizing": 90,
                    "completed": 100,
                    "error": 0
                }
                
                progress_percent = step_percentages.get(current_step, 10)
                
                # Извлекаем историю сообщений
                logs = []
                for msg in progress_data.get("messages", []):
                    try:
                        timestamp = datetime.fromtimestamp(msg.get("timestamp", 0)).strftime("%H:%M:%S")
                        logs.append(f"[{timestamp}] {msg.get('message', '')}")
                    except Exception:
                        # В случае ошибки добавляем сообщение без временной метки
                        logs.append(msg.get('message', ''))
                
                return {
                    "status": "processing",
                    "progress": progress_percent,
                    "message": progress_data.get("current_message", "Обработка в процессе..."),
                    "current_step": current_step,
                    "logs": logs
                }
            except json.JSONDecodeError:
                # Если файл JSON поврежден, считаем, что обработка идет
                return {
                    "status": "processing",
                    "progress": 10,
                    "message": "Начальная обработка...",
                    "logs": ["Файл прогресса поврежден, но обработка продолжается"]
                }
        
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
    except Exception as e:
        print(f"Ошибка при проверке прогресса: {str(e)}")
        return {
            "status": "error",
            "progress": 0,
            "message": f"Ошибка при проверке прогресса: {str(e)}",
            "logs": [f"Ошибка: {str(e)}"]
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
    
@router.get("/calls/result/{call_id}")
async def get_call_result(call_id: str):
    """Возвращает результат анализа звонка"""
    result_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}.json")
    
    if os.path.exists(result_path):
        result = load_json(result_path)
        
        # Добавляем разделение диалога, если его еще нет
        if "dialogue" not in result and "transcript" in result:
            dialogue = dialogue_splitter.split_dialogue(result["transcript"])
            result["dialogue"] = dialogue
            
            # Сохраняем обновленный результат
            save_json(result_path, result)
        
        return result
    else:
        raise HTTPException(status_code=404, detail="Результат анализа не найден")