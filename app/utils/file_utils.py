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
                
            # Пробуем загрузить JSON
            try:
                return json.loads(content)
            except json.JSONDecodeError as e:
                print(f"Ошибка при загрузке JSON: {str(e)}")
                # Выводим первые несколько строк для отладки
                with open(file_path, 'r', encoding='utf-8') as debug_f:
                    lines = debug_f.readlines()[:5]  # Первые 5 строк
                    print(f"Содержимое проблемного файла: {lines}")
                
                # Возвращаем пустой объект вместо ошибки
                return {}
                
    except Exception as e:
        print(f"Ошибка при загрузке файла: {str(e)}")
        return {}

def get_all_analysis_files(directory: str) -> List[str]:
    """
    Получает список всех файлов с результатами анализа
    
    Args:
        directory (str): Директория с файлами
        
    Returns:
        List[str]: Список путей к файлам
    """
    # Ищем все JSON-файлы, которые не содержат '_progress' и '_error' в названии
    files = glob.glob(os.path.join(directory, "*.json"))
    
    # Исключаем файлы прогресса и ошибок
    files = [f for f in files if 
             not f.endswith("_progress.json") and 
             not f.endswith("_error.json") and 
             not "_processing" in f]
    
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

