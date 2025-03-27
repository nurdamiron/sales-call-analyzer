import os
import json
import glob
from typing import Dict, List, Any
from pydub import AudioSegment
from datetime import datetime  # Добавьте эту строку

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def save_json(file_path: str, data: Dict) -> bool:
    """
    Сохраняет данные в JSON-файл
    
    Args:
        file_path (str): Путь к файлу
        data (Dict): Данные для сохранения
        
    Returns:
        bool: True если успешно, иначе False
    """
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
        return True
    except Exception as e:
        print(f"Ошибка при сохранении JSON: {str(e)}")
        return False
    
def get_audio_duration(file_path: str) -> float:
    """
    Получает длительность аудиофайла в секундах
    
    Args:
        file_path (str): Путь к аудиофайлу
        
    Returns:
        float: Длительность в секундах
    """
    try:
        audio = AudioSegment.from_file(file_path)
        return len(audio) / 1000.0  # Преобразуем миллисекунды в секунды
    except Exception as e:
        print(f"Ошибка при получении длительности аудио: {str(e)}")
        return 0.0


def load_json(file_path: str) -> Dict:
    """
    Загружает данные из JSON-файла
    
    Args:
        file_path (str): Путь к файлу
        
    Returns:
        Dict: Загруженные данные
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # Проверка на пустой файл
            if not content.strip():
                print(f"Пустой JSON файл: {file_path}")
                return {}
            return json.loads(content)
    except json.JSONDecodeError as e:
        print(f"Ошибка при загрузке JSON: {str(e)}")
        # Попытка восстановить файл
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                print(f"Содержимое проблемного файла: {lines[:5]}")  # Вывод первых 5 строк для отладки
        except Exception:
            pass
        return {}
    except Exception as e:
        print(f"Ошибка при загрузке JSON: {str(e)}")
        return {}

def get_all_analysis_files(directory: str) -> List[str]:
    """
    Получает список всех файлов с результатами анализа
    
    Args:
        directory (str): Директория с файлами
        
    Returns:
        List[str]: Список путей к файлам
    """
    # Ищем все JSON-файлы, которые не являются файлами ошибок
    files = glob.glob(os.path.join(directory, "*.json"))
    
    # Исключаем файлы с ошибками
    files = [f for f in files if not f.endswith("_error.json")]
    
    return files

def format_duration(seconds: float) -> str:
    """
    Форматирует длительность в удобочитаемый формат
    
    Args:
        seconds (float): Длительность в секундах
        
    Returns:
        str: Отформатированная строка (MM:SS)
    """
    minutes = int(seconds // 60)
    seconds = int(seconds % 60)
    return f"{minutes:02d}:{seconds:02d}"

