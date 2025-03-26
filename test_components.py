#!/usr/bin/env python
import os
import sys
import time
import argparse
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

def test_whisper_api():
    """Тестирует подключение к Whisper API"""
    try:
        import openai
        
        openai.api_key = os.getenv("OPENAI_API_KEY")
        if not openai.api_key:
            print("❌ Ошибка: API ключ OpenAI не найден в переменных окружения")
            return False
        
        print("🔄 Тестирование подключения к Whisper API...")
        
        # Простой запрос для проверки подключения
        response = openai.Completion.create(
            model="text-davinci-003",
            prompt="Привет",
            max_tokens=5
        )
        
        print("✅ Успешное подключение к OpenAI API")
        return True
    except Exception as e:
        print(f"❌ Ошибка при подключении к OpenAI API: {str(e)}")
        return False

def test_anthropic_api():
    """Тестирует подключение к Anthropic API"""
    try:
        import anthropic
        
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            print("❌ Ошибка: API ключ Anthropic не найден в переменных окружения")
            return False
        
        print("🔄 Тестирование подключения к Anthropic API...")
        
        client = anthropic.Anthropic(api_key=api_key)
        
        # Простой запрос для проверки подключения
        response = client.messages.create(
            model="claude-3-opus-20240229",
            max_tokens=10,
            messages=[
                {"role": "user", "content": "Привет"}
            ]
        )
        
        print("✅ Успешное подключение к Anthropic API")
        return True
    except Exception as e:
        print(f"❌ Ошибка при подключении к Anthropic API: {str(e)}")
        return False

def test_audio_processing():
    """Тестирует обработку аудиофайлов с помощью FFmpeg и pydub"""
    try:
        from pydub import AudioSegment
        
        print("🔄 Тестирование обработки аудио...")
        
        # Пробуем создать короткий аудиофайл
        sample_rate = 44100  # 44.1kHz
        sample_size = 2      # 16-bit (2 bytes)
        channels = 2         # Stereo
        
        # Создаем 500ms тишины
        silent_segment = AudioSegment.silent(duration=500, frame_rate=sample_rate)
        
        # Проверяем свойства сегмента
        if (silent_segment.frame_rate == sample_rate and 
            silent_segment.sample_width == sample_size and 
            silent_segment.channels == channels):
            print("✅ Успешное создание аудиосегмента")
            
            # Пробуем экспортировать
            test_file = "test_audio.mp3"
            silent_segment.export(test_file, format="mp3")
            
            if os.path.exists(test_file):
                print(f"✅ Успешное создание тестового аудиофайла ({test_file})")
                
                # Удаляем тестовый файл
                os.remove(test_file)
                print(f"✅ Тестовый аудиофайл удален")
                return True
            else:
                print("❌ Не удалось создать тестовый аудиофайл")
                return False
        else:
            print("❌ Созданный аудиосегмент имеет неверные параметры")
            return False
    except Exception as e:
        print(f"❌ Ошибка при обработке аудио: {str(e)}")
        return False

def test_api_endpoints():
    """Тестирует API эндпоинты приложения"""
    try:
        import requests
        
        print("🔄 Тестирование API эндпоинтов...")
        print("⚠️ Для этого теста должно быть запущено приложение")
        
        base_url = "http://localhost:8000/api"
        
        endpoints = [
            "/calls",
        ]
        
        all_ok = True
        
        for endpoint in endpoints:
            try:
                response = requests.get(f"{base_url}{endpoint}")
                if response.status_code == 200:
                    print(f"✅ Эндпоинт {endpoint} доступен")
                else:
                    print(f"❌ Эндпоинт {endpoint} вернул код {response.status_code}")
                    all_ok = False
            except requests.RequestException:
                print(f"❌ Не удалось подключиться к эндпоинту {endpoint}")
                all_ok = False
        
        return all_ok
    except Exception as e:
        print(f"❌ Ошибка при тестировании API: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Тестирование компонентов системы анализа звонков")
    parser.add_argument("--all", action="store_true", help="Запустить все тесты")
    parser.add_argument("--whisper", action="store_true", help="Тестировать Whisper API")
    parser.add_argument("--anthropic", action="store_true", help="Тестировать Anthropic API")
    parser.add_argument("--audio", action="store_true", help="Тестировать обработку аудио")
    parser.add_argument("--api", action="store_true", help="Тестировать API эндпоинты (требуется запущенный сервер)")
    
    args = parser.parse_args()
    
    # Если не указаны конкретные тесты, запускаем все
    if not (args.whisper or args.anthropic or args.audio or args.api):
        args.all = True
    
    print("🚀 Запуск тестов компонентов системы анализа звонков")
    print("=" * 50)
    
    results = {}
    
    if args.all or args.whisper:
        print("\n📋 Тест #1: Whisper API")
        results["whisper"] = test_whisper_api()
        print()
    
    if args.all or args.anthropic:
        print("\n📋 Тест #2: Anthropic API")
        results["anthropic"] = test_anthropic_api()
        print()
    
    if args.all or args.audio:
        print("\n📋 Тест #3: Обработка аудио")
        results["audio"] = test_audio_processing()
        print()
    
    if args.all or args.api:
        print("\n📋 Тест #4: API эндпоинты")
        results["api"] = test_api_endpoints()
        print()
    
    print("\n📊 Результаты тестирования:")
    print("=" * 50)
    
    all_passed = True
    for test, result in results.items():
        status = "✅ ПРОЙДЕН" if result else "❌ НЕ ПРОЙДЕН"
        print(f"{test.upper()}: {status}")
        if not result:
            all_passed = False
    
    if all_passed:
        print("\n🎉 Все тесты успешно пройдены! Система готова к использованию.")
    else:
        print("\n⚠️ Некоторые тесты не пройдены. Проверьте ошибки и повторите попытку.")

if __name__ == "__main__":
    main()