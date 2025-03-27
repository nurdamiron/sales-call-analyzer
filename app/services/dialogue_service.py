# app/services/dialogue_service.py
import re
from typing import List, Tuple, Dict

class DialogueSplitter:
    """
    Сервис для разделения диалога на реплики продавца и клиента
    """
    def __init__(self):
        # Шаблоны фраз, характерные для продавца
        self.seller_patterns = [
            r'я из компании', r'специальное предложение', r'предлагаем', r'наш продукт',
            r'наш товар', r'стоимость', r'цена', r'скидка', r'предложение', r'каталог',
            r'меня зовут', r'свяжусь с вами', r'могу предложить', r'здравствуйте'
        ]
        
        # Шаблоны фраз, характерные для клиента
        self.client_patterns = [
            r'интересует', r'сколько стоит', r'когда', r'цена', r'подумаю', 
            r'хорошо', r'понятно', r'согласен', r'не согласен', r'перезвоните'
        ]
    
    def split_dialogue(self, transcript: str) -> List[Dict]:
        """
        Разделяет текст транскрипции на реплики продавца и клиента
        
        Args:
            transcript (str): Полный текст транскрипции
            
        Returns:
            List[Dict]: Список словарей с репликами и указанием говорящего
        """
        # Разбиваем текст на предложения по знакам препинания, с сохранением знаков
        sentences = re.findall(r'[^.!?]+[.!?]', transcript)
        
        # Если разбиение не получилось, возвращаем весь текст как одну реплику продавца
        if not sentences:
            return [{'speaker': 'seller', 'text': transcript}]
        
        dialogue = []
        current_speaker = 'seller'  # Начинаем с предположения, что первым говорит продавец
        current_utterance = ""
        
        for sentence in sentences:
            # Определяем, кому скорее всего принадлежит фраза
            seller_score = 0
            client_score = 0
            
            # Подсчитываем совпадения с шаблонами продавца
            for pattern in self.seller_patterns:
                if re.search(pattern, sentence.lower()):
                    seller_score += 1
            
            # Подсчитываем совпадения с шаблонами клиента
            for pattern in self.client_patterns:
                if re.search(pattern, sentence.lower()):
                    client_score += 1
            
            # Определяем говорящего на основе счетчиков
            speaker = current_speaker
            if seller_score > client_score:
                speaker = 'seller'
            elif client_score > seller_score:
                speaker = 'client'
            
            # Если говорящий изменился, добавляем предыдущую реплику в диалог
            if speaker != current_speaker and current_utterance:
                dialogue.append({
                    'speaker': current_speaker,
                    'text': current_utterance.strip()
                })
                current_utterance = ""
            
            # Добавляем текущее предложение к реплике
            current_utterance += sentence + " "
            current_speaker = speaker
        
        # Добавляем последнюю реплику
        if current_utterance:
            dialogue.append({
                'speaker': current_speaker,
                'text': current_utterance.strip()
            })
        
        return dialogue
    
    def format_dialogue_html(self, dialogue: List[Dict]) -> str:
        """
        Форматирует диалог в HTML-разметку для отображения
        
        Args:
            dialogue (List[Dict]): Список словарей с репликами
            
        Returns:
            str: HTML-разметка диалога
        """
        html = ""
        for utterance in dialogue:
            speaker_class = "seller-utterance" if utterance['speaker'] == 'seller' else "client-utterance"
            speaker_name = "Продавец" if utterance['speaker'] == 'seller' else "Клиент"
            
            html += f'<div class="utterance {speaker_class}">'
            html += f'<div class="speaker-label">{speaker_name}</div>'
            html += f'<div class="utterance-text">{utterance["text"]}</div>'
            html += '</div>'
        
        return html