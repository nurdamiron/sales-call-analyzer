import os
import json
from dotenv import load_dotenv
import requests

# Загрузка переменных окружения
load_dotenv()

# Получаем API ключ из переменных окружения
api_key = os.getenv("OPENAI_API_KEY")

async def transcribe_audio(file_path: str) -> str:
    """
    Транскрибирует аудиофайл в текст с использованием Whisper API через прямой HTTP запрос
    
    Args:
        file_path (str): Путь к аудиофайлу
        
    Returns:
        str: Текстовая транскрипция аудио
    """
    try:
        # URL для запроса к API Whisper
        url = "https://api.openai.com/v1/audio/transcriptions"
        
        # Параметры запроса
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        
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
            
            # Выполнение запроса
            response = requests.post(url, headers=headers, files=files, data=data)
            
            # Проверка статуса
            if response.status_code == 200:
                # Получаем результат
                result = response.json()
                return result.get("text", "")
            else:
                print(f"Ошибка API: {response.status_code}, {response.text}")
                return "Не удалось транскрибировать аудио"
            
    except Exception as e:
        print(f"Ошибка при транскрибировании аудио: {str(e)}")
        # В случае ошибки возвращаем заглушку
        return "Не удалось транскрибировать аудио"

# Альтернативная функция для использования локальной модели Whisper
# (требует установки whisper и FFmpeg)
async def transcribe_audio_local(file_path: str) -> str:
    """
    Транскрибирует аудиофайл в текст с использованием локальной модели Whisper
    
    Args:
        file_path (str): Путь к аудиофайлу
        
    Returns:
        str: Текстовая транскрипция аудио
    """
    try:
        import whisper
        
        # Загрузка модели (можно использовать "tiny", "base", "small", "medium", "large")
        model = whisper.load_model("small")
        
        # Транскрибирование
        result = model.transcribe(file_path, language="ru")
        
        return result["text"]
        
    except Exception as e:
        print(f"Ошибка при локальном транскрибировании аудио: {str(e)}")
        return "Не удалось транскрибировать аудио"