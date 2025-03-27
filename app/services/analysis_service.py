import os
import json
import time
import requests
from typing import Dict, List, Tuple, Any, Optional
from dotenv import load_dotenv
from app.prompts.analysis_prompt import get_analysis_prompt

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


async def analyze_transcript(transcript: str, call_id: Optional[str] = None) -> Tuple[Dict[str, str], Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    """
    Анализирует транскрипцию звонка с использованием OpenAI API через прямой HTTP запрос
    
    Args:
        transcript (str): Текст транскрипции звонка
        call_id (str, optional): ID звонка для логирования
        
    Returns:
        Tuple[Dict[str, str], Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]], List[str]]: 
            - Анализ по этапам разговора
            - Оценки
            - Лучшие моменты
            - Худшие моменты
            - Рекомендации
    """
    try:
        if call_id:
            log_progress(call_id, "Начало анализа текста разговора", "analysis_start")
            log_progress(call_id, f"Анализируется текст длиной {len(transcript)} символов ({len(transcript.split())} слов)")
        
        # URL для запроса к API ChatGPT
        url = "https://api.openai.com/v1/chat/completions"
        
        # Заголовки запроса
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        if call_id:
            log_progress(call_id, "Подготовка промпта для анализа", "analysis")
        
        # Формируем системное сообщение
        system_message = """
        Ты - эксперт по анализу продаж и качества обслуживания. Твоя задача - проанализировать транскрипцию звонка продажника с клиентом.
        Ты должен вернуть результат анализа только в JSON формате, без дополнительного текста.
        """
        
        # Получаем пользовательский промпт из модуля промптов
        user_message = get_analysis_prompt(transcript)
        
        # Подготовка данных для запроса
        payload = {
            "model": "gpt-4",  # Используем GPT-4, можно заменить на другую доступную модель
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            "temperature": 0.7,
            "max_tokens": 2000
        }
        
        if call_id:
            log_progress(call_id, "Отправка запроса на анализ в OpenAI API")
        
        # Выполнение запроса
        response = requests.post(url, headers=headers, json=payload)
        
        # Проверка статуса
        if response.status_code == 200:
            if call_id:
                log_progress(call_id, "Ответ от API получен, обработка результатов")
            
            # Получаем результат
            response_data = response.json()
            content = response_data["choices"][0]["message"]["content"]
            result_json = json.loads(content)
            
            # Извлекаем компоненты результата
            analysis = result_json.get("analysis", {})
            score = result_json.get("score", {})
            best_moments = result_json.get("best_moments", [])
            worst_moments = result_json.get("worst_moments", [])
            recommendations = result_json.get("recommendations", [])
            
            # Рассчитываем общую оценку, исключая "N/A" оценки
            criterion_scores = []
            
            # Проходим по всем критериям и добавляем числовые оценки
            for criterion in ["script_adherence", "active_listening", "sales_techniques", "communication_ethics"]:
                if criterion in score and "score" in score[criterion]:
                    criterion_score = score[criterion]["score"]
                    if isinstance(criterion_score, (int, float)):
                        criterion_scores.append(criterion_score)
            
            # Проверяем оценку за обработку возражений
            objection_criterion = "objection_handling"
            if objection_criterion in score and "score" in score[objection_criterion]:
                objection_score = score[objection_criterion]["score"]
                # Только если это числовое значение, а не "N/A"
                if objection_score != "N/A" and isinstance(objection_score, (int, float)):
                    criterion_scores.append(objection_score)
            
            # Рассчитываем средний балл, если есть оценки
            if criterion_scores:
                overall_score = round(sum(criterion_scores) / len(criterion_scores), 1)
            else:
                overall_score = 0  # На случай, если нет критериев
            
            # Добавляем общую оценку
            score["overall"] = overall_score
            
            if call_id:
                log_progress(call_id, f"Общая оценка звонка: {score.get('overall', 'N/A')}/10")
                log_progress(call_id, f"Выявлено {len(best_moments)} сильных и {len(worst_moments)} слабых моментов")
                log_progress(call_id, f"Подготовлено {len(recommendations)} рекомендаций")
                log_progress(call_id, "Формирование итогового отчета", "finalizing")
                log_progress(call_id, "Анализ успешно завершен", "completed")
            
            return analysis, score, best_moments, worst_moments, recommendations
        else:
            error_msg = f"Ошибка API: {response.status_code}, {response.text}"
            if call_id:
                log_progress(call_id, f"Ошибка при анализе: {error_msg}")
            print(error_msg)
            raise Exception(f"Ошибка API: {response.status_code}")
        
    except Exception as e:
        error_msg = f"Ошибка при анализе транскрипции: {str(e)}"
        if call_id:
            log_progress(call_id, error_msg, "error")
        print(error_msg)
        
        # В случае ошибки возвращаем базовые данные
        default_analysis = {
            "greeting": "Не удалось проанализировать",
            "needs_identification": "Не удалось проанализировать",
            "presentation": "Не удалось проанализировать",
            "objection_handling": "Не удалось проанализировать",
            "closing": "Не удалось проанализировать"
        }
        
        if "objection_handling" in score and score["objection_handling"].get("score") == "N/A":
            score["objection_handling"]["score"] = None
        
        default_score = {
            "script_adherence": {"score": 5.0, "comment": "Автоматическая оценка из-за ошибки"},
            "active_listening": {"score": 5.0, "comment": "Автоматическая оценка из-за ошибки"},
            "objection_handling": {"score": "N/A", "comment": "Не удалось проанализировать"},
            "sales_techniques": {"score": 5.0, "comment": "Автоматическая оценка из-за ошибки"},
            "communication_ethics": {"score": 5.0, "comment": "Автоматическая оценка из-за ошибки"},
            "overall": 5.0
        }
        
        default_moments = [{"text": "Не удалось выделить", "comment": "Произошла ошибка анализа"}]
        default_recommendations = ["Повторите анализ позже"]
        
        return default_analysis, default_score, default_moments, default_moments, default_recommendations