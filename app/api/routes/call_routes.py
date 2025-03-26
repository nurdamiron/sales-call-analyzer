import os
import shutil
import uuid
from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, Depends
from typing import Optional, List
from datetime import datetime

from app.models.schemas import CallUpload, CallAnalysisResult, CallListItem
from app.services.transcription_service import transcribe_audio
from app.services.analysis_service import analyze_transcript
from app.utils.file_utils import get_audio_duration, save_json, load_json, get_all_analysis_files

router = APIRouter()

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
    """Обрабатывает звонок: транскрибирует и анализирует"""
    try:
        # Создаем файл-маркер, что звонок в обработке
        processing_path = os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_processing")
        with open(processing_path, "w") as f:
            f.write("processing")
        
        # Подготавливаем метаданные
        metadata = {}
        if call_data:
            import json
            metadata = json.loads(call_data)
        
        # Получаем длительность аудио
        duration = get_audio_duration(file_path)
        
        # Транскрибируем аудио
        transcript = await transcribe_audio(file_path)
        
        # Анализируем транскрипцию
        analysis, score, best_moments, worst_moments, recommendations = await analyze_transcript(transcript)
        
        # Создаем результат анализа
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
        
        # Удаляем файл-маркер обработки
        if os.path.exists(processing_path):
            os.remove(processing_path)
            
    except Exception as e:
        # Логируем ошибку
        import traceback
        with open(os.path.join(os.getenv("RESULTS_DIR"), f"{call_id}_error.log"), "w") as f:
            f.write(f"Error: {str(e)}\n")
            f.write(traceback.format_exc())
        
        # Удаляем файл-маркер обработки
        if os.path.exists(processing_path):
            os.remove(processing_path)