# Обновления для файла app/services/transcription_service.py
# Добавьте эти импорты в начало файла app/services/transcription_service.py

import os
import json
import time
import requests
from typing import Optional
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

# Получаем API ключ из переменных окружения
api_key = os.getenv("OPENAI_API_KEY")

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

# Далее должна идти функция transcribe_audio

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

# Обновите функцию transcribe_audio, добавив логирование:
async def transcribe_audio(file_path: str, call_id: Optional[str] = None) -> str:
    """
    Транскрибирует аудиофайл в текст с использованием Whisper API через прямой HTTP запрос
    
    Args:
        file_path (str): Путь к аудиофайлу
        call_id (str, optional): ID звонка для логирования
        
    Returns:
        str: Текстовая транскрипция аудио
    """
    try:
        if call_id:
            log_progress(call_id, "Начало транскрибирования аудио", "transcription_start")
        
        # URL для запроса к API Whisper
        url = "https://api.openai.com/v1/audio/transcriptions"
        
        # Параметры запроса
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        
        if call_id:
            log_progress(call_id, "Подготовка аудиофайла для отправки")
        
        # Подготовка файла
        with open(file_path, "rb") as audio_file:
            files = {
                "file": (os.path.basename(file_path), audio_file, "audio/mpeg")
            }
            
            # Форма данных
            data = {
                "model": "whisper-1",
                "language": "ru"
            }
            
            if call_id:
                log_progress(call_id, "Отправка аудио в Whisper API")
            
            # Выполнение запроса
            response = requests.post(url, headers=headers, files=files, data=data)
            
            # Проверка статуса
            if response.status_code == 200:
                # Получаем результат
                result = response.json()
                transcript = result.get("text", "")
                
                if call_id:
                    words_count = len(transcript.split())
                    log_progress(
                        call_id, 
                        f"Транскрипция успешно завершена. Получено {words_count} слов.", 
                        "transcription"
                    )
                
                return transcript
            else:
                error_msg = f"Ошибка API: {response.status_code}, {response.text}"
                if call_id:
                    log_progress(call_id, f"Ошибка при получении транскрипции: {error_msg}")
                print(error_msg)
                return "Не удалось транскрибировать аудио"
            
    except Exception as e:
        error_msg = f"Ошибка при транскрибировании аудио: {str(e)}"
        if call_id:
            log_progress(call_id, error_msg)
        print(error_msg)
        # В случае ошибки возвращаем заглушку
        return "Не удалось транскрибировать аудио"

async def transcribe_audio_advanced(file_path: str, call_id: Optional[str] = None, language: Optional[str] = None) -> str:
    """
    Расширенная транскрипция с дополнительной обработкой и проверками
    """
    try:
        if call_id:
            log_progress(call_id, "Начало продвинутой транскрипции", "transcription_advanced")
        
        # Подготавливаем аудио (нормализация, удаление шума)
        from pydub import AudioSegment
        from pydub.effects import normalize
        
        log_progress(call_id, "Подготовка аудио для транскрипции...")
        audio = AudioSegment.from_file(file_path)
        
        # Нормализация громкости
        normalized_audio = normalize(audio)
        
        # Сохраняем временно обработанное аудио
        processed_file = f"{file_path}_processed.mp3"
        normalized_audio.export(processed_file, format="mp3")
        
        # Разделение на сегменты для более точной транскрипции
        if len(normalized_audio) > 300000:  # Более 5 минут
            log_progress(call_id, "Разделяем аудио на сегменты для более точной транскрипции")
            
            segment_duration = 300000  # 5 минут в миллисекундах
            segments = []
            
            for i in range(0, len(normalized_audio), segment_duration):
                segment = normalized_audio[i:min(i + segment_duration, len(normalized_audio))]
                segment_file = f"{file_path}_segment_{i}.mp3"
                segment.export(segment_file, format="mp3")
                segments.append(segment_file)
            
            # Транскрибируем каждый сегмент
            transcriptions = []
            for i, segment_file in enumerate(segments):
                log_progress(call_id, f"Транскрибирование сегмента {i+1}/{len(segments)}")
                segment_transcript = await transcribe_audio(segment_file, None, language)
                transcriptions.append(segment_transcript)
                
                # Удаляем временный файл
                try:
                    os.remove(segment_file)
                except:
                    pass
            
            # Объединяем транскрипции
            full_transcript = " ".join(transcriptions)
            
        else:
            # Транскрибируем файл целиком если он не слишком длинный
            full_transcript = await transcribe_audio(processed_file, None, language)
        
        # Удаляем временный файл
        try:
            os.remove(processed_file)
        except:
            pass
        
        # Постобработка транскрипции
        if language == "kk":
            # Специфические замены для казахского языка
            replacements = [
                ("men", "мен"),
                ("sen", "сен"),
                # Добавьте другие специфические замены
            ]
            
            for old, new in replacements:
                full_transcript = full_transcript.replace(old, new)
        
        if call_id:
            log_progress(
                call_id, 
                f"Продвинутая транскрипция завершена: {len(full_transcript.split())} слов", 
                "transcription_complete"
            )
        
        return full_transcript
        
    except Exception as e:
        error_msg = f"Ошибка при продвинутой транскрипции: {str(e)}"
        if call_id:
            log_progress(call_id, error_msg, "error")
        print(error_msg)
        
        # В случае ошибки пробуем простую транскрипцию
        return await transcribe_audio(file_path, call_id, language)