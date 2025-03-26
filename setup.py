#!/usr/bin/env python
import os
import sys
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

def setup_directories():
    """Создает необходимые директории для работы приложения"""
    print("Настройка директорий приложения...")
    
    # Директории, которые нужно создать
    directories = [
        "app/static/uploads",
        "app/static/results",
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"Создана директория: {directory}")
    
    print("Настройка директорий завершена.")
    
def check_environment():
    """Проверяет настройки окружения и наличие API ключей"""
    print("Проверка окружения...")
    
    # Проверяем наличие API ключей
    required_vars = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]
    missing_vars = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print("Внимание! Отсутствуют следующие переменные окружения:")
        for var in missing_vars:
            print(f" - {var}")
        print("\nДобавьте эти переменные в файл .env перед запуском приложения.")
    else:
        print("Все необходимые API ключи найдены.")
    
    # Проверяем FFmpeg
    try:
        import subprocess
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("FFmpeg установлен и доступен.")
    except (subprocess.SubprocessError, FileNotFoundError):
        print("Внимание! FFmpeg не найден в системе.")
        print("Для корректной работы с аудиофайлами установите FFmpeg:")
        print(" - Windows: Скачайте с https://ffmpeg.org/download.html и добавьте в PATH")
        print(" - Linux: sudo apt install ffmpeg")
        print(" - macOS: brew install ffmpeg")
    
    print("Проверка окружения завершена.")

if __name__ == "__main__":
    print("Настройка проекта для анализатора звонков продажников")
    print("=" * 50)
    
    setup_directories()
    print()
    check_environment()
    
    print("\nНастройка завершена! Теперь вы можете запустить приложение командой:")
    print("python run.py")