# app/services/language_detection.py
import os
import requests
from typing import Optional
from pydub import AudioSegment

def detect_audio_language(file_path: str, call_id: Optional[str] = None) -> str:
    """
    Определяет язык аудиофайла с помощью Whisper API
    
    Args:
        file_path (str): Путь к аудиофайлу
        call_id (str, optional): ID звонка для логирования
        
    Returns:
        str: Код языка (ru, kk, etc.)
    """
    try:
        from app.services.transcription_service import log_progress
        
        if call_id:
            log_progress(call_id, "Определение языка аудио", "language_detection")
        
        # API-ключ из переменных окружения
        api_key = os.getenv("OPENAI_API_KEY")
        
        # URL для запроса к API Whisper
        url = "https://api.openai.com/v1/audio/transcriptions"
        
        # Заголовки
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        
        # Отправляем короткий фрагмент аудио для определения языка (первые 30 секунд)
        audio = AudioSegment.from_file(file_path)
        sample_duration = min(30000, len(audio))  # 30 секунд или меньше
        sample = audio[:sample_duration]
        
        # Сохраняем временный файл
        temp_file = f"{file_path}_sample.mp3"
        sample.export(temp_file, format="mp3")
        
        if call_id:
            log_progress(call_id, f"Создан семпл для определения языка ({sample_duration/1000:.1f} сек)")
        
        # Подготовка запроса
        with open(temp_file, "rb") as audio_file:
            files = {
                "file": (os.path.basename(temp_file), audio_file, "audio/mpeg")
            }
            
            data = {
                "model": "whisper-1",
                "response_format": "json"
            }
            
            # Отправляем запрос
            response = requests.post(url, headers=headers, files=files, data=data)
            
        # Удаляем временный файл
        try:
            os.remove(temp_file)
        except:
            pass
            
        # Анализируем ответ
        if response.status_code == 200:
            result = response.json()
            detected_language = result.get("language", "").lower()
            
            if call_id:
                log_progress(call_id, f"Определен язык API: {detected_language}")
                
            # Преобразуем некоторые коды языков
            language_mapping = {
                "kazakh": "kk",
                "ru": "ru",
                "russian": "ru",
                "kk": "kk",
                "kazak": "kk"
            }
            
            # Дополнительная проверка на казахский язык по содержанию текста
            if detected_language not in language_mapping:
                text = result.get("text", "").lower()
                kz_markers = ["қазақ", "қаражат", "кездесу", "келісім", "қарыз", "керек", "ұйым"]
                if any(marker in text for marker in kz_markers):
                    if call_id:
                        log_progress(call_id, "Определен казахский язык по содержанию текста")
                    return "kk"
            
            return language_mapping.get(detected_language, "ru")
        else:
            # В случае ошибки возвращаем русский по умолчанию
            if call_id:
                log_progress(call_id, f"Ошибка определения языка, используем русский по умолчанию")
            return "ru"
            
    except Exception as e:
        if call_id:
            log_progress(call_id, f"Ошибка при определении языка: {str(e)}")
        # По умолчанию возвращаем русский
        return "ru"