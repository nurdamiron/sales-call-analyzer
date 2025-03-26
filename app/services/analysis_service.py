import os
import json
import requests
from typing import Dict, List, Tuple, Any
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

# Получаем API ключ из переменных окружения
api_key = os.getenv("OPENAI_API_KEY")

async def analyze_transcript(transcript: str) -> Tuple[Dict[str, str], Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    """
    Анализирует транскрипцию звонка с использованием OpenAI API через прямой HTTP запрос
    
    Args:
        transcript (str): Текст транскрипции звонка
        
    Returns:
        Tuple[Dict[str, str], Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]], List[str]]: 
            - Анализ по этапам разговора
            - Оценки
            - Лучшие моменты
            - Худшие моменты
            - Рекомендации
    """
    try:
        # URL для запроса к API ChatGPT
        url = "https://api.openai.com/v1/chat/completions"
        
        # Заголовки запроса
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # Формируем промпт для анализа
        system_message = """
        Ты - эксперт по анализу продаж и качества обслуживания. Твоя задача - проанализировать транскрипцию звонка продажника с клиентом.
        Ты должен вернуть результат анализа только в JSON формате, без дополнительного текста.
        """
        
        user_message = f"""
        Проанализируй следующую транскрипцию звонка продажника с клиентом и дай подробный анализ. 
        Оцени по шкале от 0 до 10 следующие аспекты:
        1. Соблюдение скрипта продаж (script_adherence)
        2. Активное слушание (active_listening)
        3. Работа с возражениями (objection_handling)
        4. Применение техник продаж (sales_techniques)
        5. Этика общения (communication_ethics)
        
        Также выдели:
        - Анализ по этапам разговора (greeting, needs_identification, presentation, objection_handling, closing)
        - 3-5 лучших моментов в разговоре с комментариями
        - 3-5 моментов, требующих улучшения, с комментариями
        - 3-5 конкретных рекомендаций для продажника
        
        Верни результат строго в формате JSON:
        {{
            "analysis": {{
                "greeting": "Анализ приветствия",
                "needs_identification": "Анализ выявления потребностей",
                "presentation": "Анализ презентации продукта",
                "objection_handling": "Анализ работы с возражениями",
                "closing": "Анализ закрытия сделки"
            }},
            "score": {{
                "script_adherence": {{
                    "score": 0-10,
                    "comment": "Комментарий к оценке"
                }},
                "active_listening": {{
                    "score": 0-10,
                    "comment": "Комментарий к оценке"
                }},
                "objection_handling": {{
                    "score": 0-10,
                    "comment": "Комментарий к оценке"
                }},
                "sales_techniques": {{
                    "score": 0-10,
                    "comment": "Комментарий к оценке"
                }},
                "communication_ethics": {{
                    "score": 0-10,
                    "comment": "Комментарий к оценке"
                }},
                "overall": 0-10
            }},
            "best_moments": [
                {{
                    "text": "Цитата из разговора",
                    "comment": "Почему это хороший момент"
                }}
            ],
            "worst_moments": [
                {{
                    "text": "Цитата из разговора",
                    "comment": "Почему это проблемный момент"
                }}
            ],
            "recommendations": [
                "Рекомендация 1",
                "Рекомендация 2"
            ]
        }}
        
        Вот транскрипция звонка:
        {transcript}
        """
        
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
        
        # Выполнение запроса
        response = requests.post(url, headers=headers, json=payload)
        
        # Проверка статуса
        if response.status_code == 200:
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
            
            # При необходимости, добавляем расчет общей оценки
            if "overall" not in score:
                # Вычисляем среднюю оценку по всем критериям
                criterion_scores = [
                    score.get("script_adherence", {}).get("score", 0),
                    score.get("active_listening", {}).get("score", 0),
                    score.get("objection_handling", {}).get("score", 0),
                    score.get("sales_techniques", {}).get("score", 0),
                    score.get("communication_ethics", {}).get("score", 0)
                ]
                score["overall"] = round(sum(criterion_scores) / len(criterion_scores), 1)
            
            return analysis, score, best_moments, worst_moments, recommendations
        else:
            print(f"Ошибка API: {response.status_code}, {response.text}")
            raise Exception(f"Ошибка API: {response.status_code}")
        
    except Exception as e:
        print(f"Ошибка при анализе транскрипции: {str(e)}")
        
        # В случае ошибки возвращаем базовые данные
        default_analysis = {
            "greeting": "Не удалось проанализировать",
            "needs_identification": "Не удалось проанализировать",
            "presentation": "Не удалось проанализировать",
            "objection_handling": "Не удалось проанализировать",
            "closing": "Не удалось проанализировать"
        }
        
        default_score = {
            "script_adherence": {"score": 5.0, "comment": "Автоматическая оценка из-за ошибки"},
            "active_listening": {"score": 5.0, "comment": "Автоматическая оценка из-за ошибки"},
            "objection_handling": {"score": 5.0, "comment": "Автоматическая оценка из-за ошибки"},
            "sales_techniques": {"score": 5.0, "comment": "Автоматическая оценка из-за ошибки"},
            "communication_ethics": {"score": 5.0, "comment": "Автоматическая оценка из-за ошибки"},
            "overall": 5.0
        }
        
        default_moments = [{"text": "Не удалось выделить", "comment": "Произошла ошибка анализа"}]
        default_recommendations = ["Повторите анализ позже"]
        
        return default_analysis, default_score, default_moments, default_moments, default_recommendations