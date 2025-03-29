import os
import json
import time
import requests
import tempfile
from typing import List, Optional, Dict, Union
from dotenv import load_dotenv
from pydub import AudioSegment

# Загрузка переменных окружения
load_dotenv()

# Получаем API ключи из переменных окружения
openai_api_key = os.getenv("OPENAI_API_KEY")

def log_progress(call_id: str, message: str, step: Optional[str] = None, log_level: str = "info"):
    """
    Записывает сообщение о прогрессе в файл логов
    
    Args:
        call_id (str): ID звонка
        message (str): Сообщение о прогрессе
        step (str, optional): Текущий этап обработки
        log_level (str): Уровень логирования (info, warning, error, debug)
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
            "message": message,
            "level": log_level
        }
        
        if step:
            log_entry["step"] = step
            current_progress["current_step"] = step
        
        # Добавляем запись в список сообщений
        current_progress["messages"].append(log_entry)
        
        # Обновляем текущее сообщение
        current_progress["current_message"] = message
        current_progress["last_update"] = current_time
        
        # Дополнительно логируем в консоль для отладки
        print(f"[{call_id}][{log_level.upper()}] {message}")
        
        # Записываем обновленный прогресс в файл
        with open(progress_file, 'w', encoding='utf-8') as f:
            json.dump(current_progress, f, ensure_ascii=False, indent=2)
            
        # Если уровень логирования - error, создаем дополнительный файл с ошибкой
        if log_level == "error":
            error_file = os.path.join(results_dir, f"{call_id}_error_details.log")
            with open(error_file, 'a', encoding='utf-8') as f:
                timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
                f.write(f"[{timestamp}] {message}\n")
            
    except Exception as e:
        print(f"Ошибка при записи прогресса: {str(e)}")

def split_audio_for_transcription(file_path: str, call_id: Optional[str] = None) -> List[str]:
    """
    Разделяет длинный аудиофайл на части для лучшей транскрипции
    
    Args:
        file_path (str): Путь к аудиофайлу
        call_id (str, optional): ID звонка для логирования
        
    Returns:
        List[str]: Список путей к сегментам аудиофайла
    """
    try:
        if call_id:
            log_progress(call_id, "Проверка необходимости разделения аудиофайла", "file_processing")
        
        # Загружаем аудиофайл
        audio = AudioSegment.from_file(file_path)
        
        # Определяем размер сегмента (10 минут)
        segment_size = 10 * 60 * 1000  # миллисекунды
        
        # Если файл меньше сегмента, возвращаем его как есть
        if len(audio) <= segment_size:
            if call_id:
                log_progress(call_id, "Аудиофайл не требует разделения")
            return [file_path]
        
        if call_id:
            log_progress(call_id, f"Разделение аудиофайла длительностью {len(audio)/1000:.1f} секунд на сегменты")
        
        # Создаем временную директорию для сегментов
        temp_dir = tempfile.mkdtemp()
        
        # Разделяем аудио на сегменты
        segments = []
        segment_count = 0
        
        for i in range(0, len(audio), segment_size):
            segment = audio[i:min(i + segment_size, len(audio))]
            segment_count += 1
            
            segment_path = os.path.join(temp_dir, f"{os.path.basename(file_path)}_segment_{segment_count}.mp3")
            segment.export(segment_path, format="mp3")
            segments.append(segment_path)
            
            if call_id:
                log_progress(call_id, f"Создан сегмент {segment_count} длительностью {len(segment)/1000:.1f} секунд")
        
        if call_id:
            log_progress(call_id, f"Аудиофайл разделен на {len(segments)} сегментов")
        
        return segments
    
    except Exception as e:
        error_msg = f"Ошибка при разделении аудиофайла: {str(e)}"
        if call_id:
            log_progress(call_id, error_msg, "error", "error")
        print(error_msg)
        # В случае ошибки возвращаем оригинальный файл
        return [file_path]

def detect_audio_language(file_path: str, call_id: Optional[str] = None) -> str:
    """
    Определяет язык аудиофайла с помощью Whisper API
    
    Args:
        file_path (str): Путь к аудиофайлу
        call_id (str, optional): ID звонка для логирования
        
    Returns:
        str: Код языка (ru, kk)
    """
    try:
        if call_id:
            log_progress(call_id, "Начало определения языка аудио", "language_detection")
        
        # Вырезаем первые 30 секунд аудио для анализа языка
        audio = AudioSegment.from_file(file_path)
        sample_duration = min(30000, len(audio))  # 30 секунд или меньше
        sample = audio[:sample_duration]
        
        # Сохраняем временный файл
        temp_file = f"{file_path}_language_sample.mp3"
        sample.export(temp_file, format="mp3")
        
        if call_id:
            log_progress(call_id, f"Создан семпл для определения языка ({sample_duration/1000:.1f} сек)")
        
        # URL для запроса к API Whisper
        url = "https://api.openai.com/v1/audio/transcriptions"
        
        # Заголовки запроса
        headers = {
            "Authorization": f"Bearer {openai_api_key}"
        }
        
        # Подготовка запроса для определения языка
        with open(temp_file, "rb") as audio_file:
            files = {
                "file": (os.path.basename(temp_file), audio_file, "audio/mpeg")
            }
            
            # Параметры запроса с флагом определения языка
            data = {
                "model": "whisper-large-v2",
                "response_format": "json"
            }
            
            if call_id:
                log_progress(call_id, "Отправка запроса на определение языка")
            
            # Выполнение запроса
            response = requests.post(url, headers=headers, files=files, data=data)
        
        # Удаляем временный файл
        try:
            os.remove(temp_file)
        except:
            pass
        
        # Проверка статуса
        if response.status_code == 200:
            # Получаем результат
            result = response.json()
            
            # Извлекаем определенный язык
            detected_language = result.get("language", "ru").lower()
            
            # Преобразуем коды языков к стандартному формату
            language_mapping = {
                "ru": "ru",
                "russian": "ru",
                "kk": "kk", 
                "kazakh": "kk",
                "kazak": "kk"
            }
            
            language_code = language_mapping.get(detected_language, "ru")
            
            if call_id:
                log_progress(call_id, f"Определен язык: {language_code} ({detected_language})")
            
            return language_code
        else:
            error_msg = f"Ошибка API при определении языка: {response.status_code}, {response.text}"
            if call_id:
                log_progress(call_id, error_msg, log_level="warning")
            print(error_msg)
            # В случае ошибки возвращаем русский по умолчанию
            return "ru"
    
    except Exception as e:
        error_msg = f"Ошибка при определении языка: {str(e)}"
        if call_id:
            log_progress(call_id, error_msg, log_level="warning")
        print(error_msg)
        # В случае ошибки возвращаем русский по умолчанию
        return "ru"

async def transcribe_audio(file_path: str, call_id: Optional[str] = None, language: Optional[str] = None) -> str:
    """
    Транскрибирует аудиофайл в текст с использованием Whisper large-v2 API
    
    Args:
        file_path (str): Путь к аудиофайлу
        call_id (str, optional): ID звонка для логирования
        language (str, optional): Код языка, если известен
        
    Returns:
        str: Текстовая транскрипция аудио
    """
    try:
        if call_id:
            log_progress(call_id, "Начало транскрибирования аудио", "transcription_start")
        
        # URL для запроса к API Whisper
        url = "https://api.openai.com/v1/audio/transcriptions"
        
        # Заголовки запроса
        headers = {
            "Authorization": f"Bearer {openai_api_key}"
        }
        
        if call_id:
            log_progress(call_id, "Подготовка аудиофайла для отправки")
        
        # Подготовка параметров запроса
        data = {
            "model": "whisper-1",  # Указываем конкретно large-v2
        }
        
        # Добавляем язык, если он определен
        if language:
            data["language"] = language
        
        if call_id:
            log_progress(call_id, f"Запуск транскрипции с моделью whisper-1" + 
                           (f", язык: {language}" if language else ""))
        
        # Подготовка файла
        with open(file_path, "rb") as audio_file:
            files = {
                "file": (os.path.basename(file_path), audio_file, "audio/mpeg")
            }
            
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
                log_progress(call_id, f"Ошибка при получении транскрипции: {error_msg}", log_level="error")
            print(error_msg)
            return "Не удалось транскрибировать аудио"
        
    except Exception as e:
        error_msg = f"Ошибка при транскрибировании аудио: {str(e)}"
        if call_id:
            log_progress(call_id, error_msg, log_level="error")
        print(error_msg)
        # В случае ошибки возвращаем заглушку
        return "Не удалось транскрибировать аудио"

async def transcribe_audio_advanced(file_path: str, call_id: Optional[str] = None) -> str:
    """
    Расширенная транскрипция с автоматическим определением языка и разделением длинных аудио
    
    Args:
        file_path (str): Путь к аудиофайлу
        call_id (str, optional): ID звонка для логирования
        
    Returns:
        str: Текстовая транскрипция аудио
    """
    try:
        if call_id:
            log_progress(call_id, "Начало расширенной транскрипции", "transcription_advanced")
        
        # Шаг 1: Определение языка
        if call_id:
            log_progress(call_id, "Определение языка аудио", "language_detection")
        language = detect_audio_language(file_path, call_id)
        if call_id:
            log_progress(call_id, f"Определен язык: {language}")
        
        # Шаг 2: Предобработка аудио (нормализация)
        if call_id:
            log_progress(call_id, "Нормализация аудио", "audio_preprocessing")
        audio = AudioSegment.from_file(file_path)
        from pydub.effects import normalize
        normalized_audio = normalize(audio)
        
        # Сохраняем нормализованное аудио во временный файл
        processed_file = f"{file_path}_normalized.mp3"
        normalized_audio.export(processed_file, format="mp3")
        if call_id:
            log_progress(call_id, "Аудио нормализовано")
        
        # Шаг 3: Разделение на сегменты для длинных файлов
        segments = split_audio_for_transcription(processed_file, call_id)
        
        # Шаг 4: Транскрибирование сегментов
        if len(segments) > 1:
            if call_id:
                log_progress(call_id, f"Транскрибирование {len(segments)} сегментов", "transcription")
            
            # Транскрибируем каждый сегмент
            transcriptions = []
            for i, segment_file in enumerate(segments):
                if call_id:
                    log_progress(call_id, f"Транскрибирование сегмента {i+1}/{len(segments)}")
                
                segment_transcript = await transcribe_audio(segment_file, None, language)
                transcriptions.append(segment_transcript)
                
                # Удаляем временный файл сегмента
                try:
                    os.remove(segment_file)
                except:
                    pass
            
            # Объединяем все транскрипции
            full_transcript = " ".join(transcriptions)
        else:
            # Если файл не был разделен, транскрибируем его полностью
            if call_id:
                log_progress(call_id, "Транскрибирование всего аудиофайла", "transcription")
            full_transcript = await transcribe_audio(processed_file, None, language)
        
        # Удаляем временный нормализованный файл
        try:
            os.remove(processed_file)
        except:
            pass
        
        # Шаг 5: Постобработка транскрипции
        if call_id:
            log_progress(call_id, "Постобработка транскрипции", "transcript_postprocessing")
        
        # Специфические замены для разных языков
        if language == "kk":
            # Замены для казахского языка
            replacements = [
                ("men", "мен"),
                ("sen", "сен"),
                ("emes", "емес"),
                ("zhane", "және"),
                ("nemese", "немесе")
            ]
            
            for old, new in replacements:
                full_transcript = full_transcript.replace(old, new)
        
        # Добавляем знаки препинания и убираем лишние пробелы
        full_transcript = " ".join(full_transcript.split())
        
        if call_id:
            log_progress(
                call_id, 
                f"Транскрипция завершена: {len(full_transcript.split())} слов", 
                "transcription_complete"
            )
        
        return full_transcript
        
    except Exception as e:
        error_msg = f"Ошибка при расширенной транскрипции: {str(e)}"
        if call_id:
            log_progress(call_id, error_msg, "error", "error")
        print(error_msg)
        
        # В случае ошибки пробуем простую транскрипцию
        try:
            return await transcribe_audio(file_path, call_id)
        except:
            return "Не удалось транскрибировать аудио"