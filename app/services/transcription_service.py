import os
import json
import openai
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

# Настройка OpenAI API
openai.api_key = os.getenv("OPENAI_API_KEY")

async def transcribe_audio(file_path: str) -> str:
    """
    Транскрибирует аудиофайл в текст с использованием Whisper API
    
    Args:
        file_path (str): Путь к аудиофайлу
        
    Returns:
        str: Текстовая транскрипция аудио
    """
    try:
        with open(file_path, "rb") as audio_file:
            response = await openai.Audio.atranscribe(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                language="ru"  # Можно настроить на нужный язык
            )
            
            # Извлекаем полный текст
            transcript = response["text"]
            
            # Если нужны сегменты с таймингами, их можно получить из segments
            # segments = response.get("segments", [])
            
            return transcript
            
    except Exception as e:
        print(f"Ошибка при транскрибировании аудио: {str(e)}")
        # В случае ошибки возвращаем пустую строку или заглушку
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