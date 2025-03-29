# app/services/dialogue_service.py
import re
from typing import List, Tuple, Dict

class DialogueSplitter:
    """
    Сервис для разделения диалога на реплики продавца и клиента
    с поддержкой русского и казахского языков
    """
    def __init__(self):
        # Шаблоны фраз для русского языка
        self.seller_patterns_ru = [
            r'я из компании', r'специальное предложение', r'предлагаем', r'наш продукт',
            r'наш товар', r'стоимость', r'цена', r'скидка', r'предложение', r'каталог',
            r'меня зовут', r'свяжусь с вами', r'могу предложить', r'здравствуйте'
        ]
        
        self.client_patterns_ru = [
            r'интересует', r'сколько стоит', r'когда', r'цена', r'подумаю', 
            r'хорошо', r'понятно', r'согласен', r'не согласен', r'перезвоните'
        ]
        
        # Шаблоны фраз для казахского языка
        self.seller_patterns_kk = [
            r'компаниядан', r'арнайы ұсыныс', r'ұсынамыз', r'біздің өнім',
            r'тауарымыз', r'құны', r'баға', r'жеңілдік', r'ұсыныс', r'каталог',
            r'атым', r'байланысамын', r'ұсына аламын', r'сәлеметсіз бе'
        ]
        
        self.client_patterns_kk = [
            r'қызықтырады', r'қанша тұрады', r'қашан', r'баға', r'ойланамын',
            r'жақсы', r'түсінікті', r'келісемін', r'келіспеймін', r'қайта қоңырау шалыңыз'
        ]
    
    def split_dialogue(self, transcript: str, language: str = "ru") -> List[Dict]:
        """
        Разделяет текст транскрипции на реплики продавца и клиента
        
        Args:
            transcript (str): Полный текст транскрипции
            language (str): Код языка (ru, kk)
            
        Returns:
            List[Dict]: Список словарей с репликами и указанием говорящего
        """
        # Выбираем шаблоны в зависимости от языка
        if language == "kk":
            seller_patterns = self.seller_patterns_kk
            client_patterns = self.client_patterns_kk
        else:
            seller_patterns = self.seller_patterns_ru
            client_patterns = self.client_patterns_ru
            
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
            for pattern in seller_patterns:
                if re.search(pattern, sentence.lower()):
                    seller_score += 1
            
            # Подсчитываем совпадения с шаблонами клиента
            for pattern in client_patterns:
                if re.search(pattern, sentence.lower()):
                    client_score += 1
            
            # Улучшенный алгоритм определения говорящего
            speaker = current_speaker
            
            # Если есть явные признаки продавца/клиента
            if seller_score > client_score * 1.5:  # С коэффициентом уверенности
                speaker = 'seller'
            elif client_score > seller_score * 1.5:
                speaker = 'client'
            # Если нет явных признаков - используем эвристики
            elif len(sentence.split()) > 30:
                # Длинные предложения скорее всего от продавца
                speaker = 'seller'
            elif '?' in sentence:
                # Вопросы чаще задает продавец
                speaker = 'seller'
            elif re.search(r'\d+', sentence):
                # Числа часто говорит продавец (цены, проценты)
                speaker = 'seller'
            
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
        
        # Постобработка диалога для улучшения качества
        dialogue = self._post_process_dialogue(dialogue, language)
        
        return dialogue
    
    def _post_process_dialogue(self, dialogue: List[Dict], language: str) -> List[Dict]:
        """
        Постобработка диалога для улучшения качества разделения
        """
        if not dialogue or len(dialogue) <= 1:
            return dialogue
            
        # Объединяем слишком короткие реплики с предыдущими
        processed_dialogue = []
        skip_next = False
        
        for i in range(len(dialogue)):
            if skip_next:
                skip_next = False
                continue
                
            current = dialogue[i]
            
            # Проверяем, не слишком ли короткая следующая реплика
            if i < len(dialogue) - 1:
                next_utterance = dialogue[i + 1]
                
                # Если следующая реплика очень короткая (1-2 слова)
                if len(next_utterance['text'].split()) <= 2:
                    # Объединяем с текущей репликой
                    current['text'] += " " + next_utterance['text']
                    skip_next = True
            
            processed_dialogue.append(current)
        
        # Проверка на разумное чередование говорящих
        # Не может быть более 3-х реплик подряд от одного говорящего
        final_dialogue = []
        consecutive_count = 1
        
        for i in range(len(processed_dialogue)):
            current = processed_dialogue[i].copy()
            
            if i > 0 and current['speaker'] == processed_dialogue[i-1]['speaker']:
                consecutive_count += 1
            else:
                consecutive_count = 1
            
            # Если более 3 реплик подряд от одного говорящего
            if consecutive_count > 3:
                # Меняем говорящего
                current['speaker'] = 'client' if current['speaker'] == 'seller' else 'seller'
                consecutive_count = 1
            
            final_dialogue.append(current)
        
        return final_dialogue
    
