// ============= Функции для выделения текста =============

// Переключение режима выделения текста
function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    
    const transcriptContainer = document.getElementById('transcriptContainer');
    const enableBtn = document.getElementById('enableSelectionBtn');
    const cancelBtn = document.getElementById('cancelSelectionBtn');
    
    if (isSelectionMode) {
        // Включаем режим выделения
        transcriptContainer.classList.add('selection-mode');
        enableBtn.classList.add('d-none');
        cancelBtn.classList.remove('d-none');
        document.getElementById('momentForm').classList.add('d-none');
        
        // Добавляем обработчик события выделения текста
        document.getElementById('transcriptText').addEventListener('mouseup', handleTextSelection);
        
        // Показываем подсказку
        showNotification('info', 'Режим выделения активирован', 'Выделите важные моменты в тексте транскрипции');
    } else {
        // Выключаем режим выделения
        transcriptContainer.classList.remove('selection-mode');
        enableBtn.classList.remove('d-none');
        cancelBtn.classList.add('d-none');
        
        // Удаляем обработчик события выделения текста
        document.getElementById('transcriptText').removeEventListener('mouseup', handleTextSelection);
    }
}

// Отмена режима выделения
function cancelSelection() {
    if (isSelectionMode) {
        toggleSelectionMode();
    }
    document.getElementById('momentForm').classList.add('d-none');
}

// Обработка выделения текста
function handleTextSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
        // Сохраняем выделенный текст
        currentSelection = selectedText;
        
        // Показываем форму для добавления комментария
        const momentForm = document.getElementById('momentForm');
        momentForm.classList.remove('d-none');
        
        // Отображаем выделенный текст в форме
        document.getElementById('selectedText').textContent = selectedText;
        
        // Очищаем предыдущий комментарий
        document.getElementById('momentComment').value = '';
        
        // Фокусируемся на поле комментария
        document.getElementById('momentComment').focus();
    }
}

// Отмена формы добавления момента
function cancelMomentForm() {
    document.getElementById('momentForm').classList.add('d-none');
    currentSelection = null;
}

// Сохранение момента
async function saveMoment() {
    if (!currentSelection) return;
    
    const momentType = document.getElementById('momentType').value;
    const momentComment = document.getElementById('momentComment').value.trim();
    
    if (!momentComment) {
        showNotification('warning', 'Внимание', 'Пожалуйста, добавьте комментарий к выделенному тексту');
        return;
    }
    
    try {
        // Показываем индикатор загрузки
        const saveMomentBtn = document.getElementById('saveMomentBtn');
        const originalText = saveMomentBtn.innerHTML;
        saveMomentBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Сохранение...';
        saveMomentBtn.disabled = true;
        
        // Создаем новый комментарий
        const newComment = {
            id: Date.now().toString(), // Генерируем уникальный ID
            text: currentSelection,
            comment: momentComment,
            type: momentType,
            created_at: new Date().toISOString()
        };
        
        // Добавляем комментарий и обновляем интерфейс
        await addNewComment(newComment);
        
        // Возвращаем оригинальный текст кнопки
        saveMomentBtn.innerHTML = originalText;
        saveMomentBtn.disabled = false;
        
        // Скрываем форму
        cancelMomentForm();
        
        // Выключаем режим выделения
        cancelSelection();
        
        // Показываем успешное сообщение
        showNotification('success', 'Комментарий добавлен', 'Выделение успешно добавлено');
        
    } catch (error) {
        console.error('Ошибка при сохранении комментария:', error);
        
        // Возвращаем оригинальный текст кнопки
        const saveMomentBtn = document.getElementById('saveMomentBtn');
        saveMomentBtn.innerHTML = '<i class="bi bi-save me-1"></i>Сохранить';
        saveMomentBtn.disabled = false;
        
        // Показываем ошибку
        showNotification('error', 'Ошибка', `Не удалось сохранить комментарий: ${error.message}`);
    }
}

// ============= Функции для работы с выделениями в тексте =============

// Применение выделений к транскрипции
function applyHighlightsToTranscript(transcript) {
    if (!transcript) return '';
    
    let highlightedTranscript = transcript;
    
    // Сортируем комментарии по длине текста (от более длинных к более коротким),
    // чтобы избежать проблем с перекрывающимися выделениями
    const sortedComments = [...callComments].sort((a, b) => b.text.length - a.text.length);
    
    // Заменяем все вхождения комментируемого текста на выделенный текст
    sortedComments.forEach(comment => {
        const escapedText = escapeRegExp(comment.text);
        const highlightedText = `<span class="highlight-${comment.type}" data-comment-id="${comment.id}">${comment.text}</span>`;
        
        // Используем регулярное выражение для замены только целых слов
        const regex = new RegExp(escapedText, 'g');
        highlightedTranscript = highlightedTranscript.replace(regex, highlightedText);
    });
    
    return highlightedTranscript;
}

// Экранирование специальных символов в регулярных выражениях
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Добавление обработчиков событий к выделенным фрагментам
function addHighlightEventListeners() {
    document.querySelectorAll('.highlight-good, .highlight-bad, .highlight-note').forEach(element => {
        element.addEventListener('click', function(event) {
            event.preventDefault();
            const commentId = this.getAttribute('data-comment-id');
            showCommentDetails(commentId);
        });
    });
}

// Отображение деталей комментария
function showCommentDetails(commentId) {
    // Находим комментарий по ID
    const comment = callComments.find(c => c.id === commentId);
    if (!comment) return;
    
    // Переключаемся на вкладку комментариев
    const commentsTab = document.getElementById('comments-tab');
    bootstrap.Tab.getOrCreateInstance(commentsTab).show();
    
    // Находим элемент комментария и применяем анимацию выделения
    const commentElement = document.getElementById(`comment-${commentId}`);
    if (commentElement) {
        commentElement.classList.add('highlight-pulse');
        commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Удаляем класс анимации через 1 секунду
        setTimeout(() => {
            commentElement.classList.remove('highlight-pulse');
        }, 1000);
    }
}