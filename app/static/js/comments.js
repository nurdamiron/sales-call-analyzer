// Глобальные переменные для работы с комментариями
let callComments = [];
let isSelectionMode = false;
let currentSelection = null;
let deleteCommentId = null;

// Модальное окно для удаления комментария
let deleteCommentModal;

// Инициализация компонентов для работы с комментариями
function initComments() {
    // Инициализация модальных окон
    deleteCommentModal = new bootstrap.Modal(document.getElementById('deleteCommentModal'));
    
    // Обработчики событий для выделения текста
    const enableSelectionBtn = document.getElementById('enableSelectionBtn');
    const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');
    const cancelMomentBtn = document.getElementById('cancelMomentBtn');
    const saveMomentBtn = document.getElementById('saveMomentBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteComment');
    const exportCommentsBtn = document.getElementById('exportCommentsBtn');
    
    if (enableSelectionBtn) enableSelectionBtn.addEventListener('click', toggleSelectionMode);
    if (cancelSelectionBtn) cancelSelectionBtn.addEventListener('click', cancelSelection);
    if (cancelMomentBtn) cancelMomentBtn.addEventListener('click', cancelMomentForm);
    if (saveMomentBtn) saveMomentBtn.addEventListener('click', saveMoment);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDeleteComment);
    if (exportCommentsBtn) exportCommentsBtn.addEventListener('click', exportComments);
}

// ============= Функции для работы с API комментариев =============

// Загрузка комментариев звонка
async function loadCallComments(callId) {
    try {
        const response = await fetch(`${API_BASE_URL}/calls/comments/${callId}`);
        if (response.status === 404) {
            // Эндпоинт не реализован, возвращаем пустой массив
            console.log("Эндпоинт комментариев не найден, использую пустой массив");
            callComments = [];
            return;
        }
        
        if (!response.ok) {
            throw new Error('Не удалось загрузить комментарии');
        }
        
        const data = await response.json();
        callComments = data.comments || [];
        
    } catch (error) {
        console.error('Ошибка при загрузке комментариев:', error);
        callComments = [];
    }
}

// Сохранение комментария на сервере
async function saveComment(comment) {
    try {
        const response = await fetch(`${API_BASE_URL}/calls/comments/${currentCallId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(comment)
        });
        
        if (!response.ok) {
            throw new Error('Не удалось сохранить комментарий');
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('Ошибка при сохранении комментария:', error);
        throw error;
    }
}

// Удаление комментария с сервера
async function deleteComment(commentId) {
    try {
        const response = await fetch(`${API_BASE_URL}/calls/comments/${currentCallId}/${commentId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Не удалось удалить комментарий');
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('Ошибка при удалении комментария:', error);
        throw error;
    }
}

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
        
        showNotification('info', 'Режим выделения', 'Выделите текст в транскрипции для добавления комментария');
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
        
        // Скрываем форму
        cancelMomentForm();
        
        // Выключаем режим выделения
        cancelSelection();
        
        showNotification('success', 'Комментарий добавлен', 'Комментарий успешно добавлен');
        
    } catch (error) {
        console.error('Ошибка при сохранении комментария:', error);
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
        element.addEventListener('click', function() {
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

// ============= Функции для управления интерфейсом комментариев =============

// Отображение списка комментариев
function renderCommentsList() {
    const commentsList = document.getElementById('commentsList');
    const noCommentsMessage = document.getElementById('noCommentsMessage');
    
    if (!commentsList || !noCommentsMessage) return;
    
    if (callComments.length === 0) {
        commentsList.innerHTML = '';
        noCommentsMessage.classList.remove('d-none');
        return;
    }
    
    noCommentsMessage.classList.add('d-none');
    
    // Сортируем комментарии по времени создания (новые в начале)
    const sortedComments = [...callComments].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );
    
    commentsList.innerHTML = '';
    
    sortedComments.forEach(comment => {
        let iconClass, cardClass, badgeText, badgeClass;
        
        switch (comment.type) {
            case 'good':
                iconClass = 'bi-emoji-smile';
                cardClass = 'comment-good';
                badgeText = 'Хороший пример';
                badgeClass = 'bg-success';
                break;
            case 'bad':
                iconClass = 'bi-emoji-frown';
                cardClass = 'comment-bad';
                badgeText = 'Требует улучшения';
                badgeClass = 'bg-danger';
                break;
            case 'note':
                iconClass = 'bi-bookmark';
                cardClass = 'comment-note';
                badgeText = 'Заметка';
                badgeClass = 'bg-primary';
                break;
            default:
                iconClass = 'bi-chat-text';
                cardClass = 'comment-note';
                badgeText = 'Комментарий';
                badgeClass = 'bg-secondary';
        }
        
        const commentDate = new Date(comment.created_at).toLocaleString();
        
        const card = document.createElement('div');
        card.className = `comment-card ${cardClass} mb-3`;
        card.id = `comment-${comment.id}`;
        card.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <i class="bi ${iconClass} comment-icon"></i>
                        <span class="badge ${badgeClass}">${badgeText}</span>
                        <small class="text-muted ms-2">${commentDate}</small>
                    </div>
                    <div class="comment-actions">
                        <button class="btn btn-sm btn-outline-secondary goto-highlight-btn" data-comment-id="${comment.id}" title="Перейти к выделению">
                            <i class="bi bi-search"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-comment-btn" data-comment-id="${comment.id}" title="Удалить комментарий">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="card-text mb-3">
                    <blockquote class="blockquote">
                        <p class="mb-0 fst-italic">"${comment.text}"</p>
                    </blockquote>
                </div>
                <p class="card-text">${comment.comment}</p>
            </div>
        `;
        
        commentsList.appendChild(card);
    });
    
    // Добавляем обработчики событий для кнопок
    commentsList.querySelectorAll('.goto-highlight-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const commentId = btn.getAttribute('data-comment-id');
            gotoHighlight(commentId);
        });
    });
    
    commentsList.querySelectorAll('.delete-comment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const commentId = btn.getAttribute('data-comment-id');
            showDeleteCommentConfirmation(commentId);
        });
    });
}

// Добавление нового комментария
async function addNewComment(comment) {
    try {
        // Отправляем комментарий на сервер
        await saveComment(comment);
        
        // Добавляем комментарий в список локально
        callComments.push(comment);
        
        // Обновляем отображение транскрипции с выделениями
        const transcriptText = document.getElementById('transcriptText');
        transcriptText.innerHTML = applyHighlightsToTranscript(transcriptText.textContent);
        
        // Добавляем обработчики событий для выделенных фрагментов
        addHighlightEventListeners();
        
        // Обновляем список комментариев
        renderCommentsList();
        
    } catch (error) {
        console.error('Ошибка при добавлении комментария:', error);
        throw error;
    }
}

// Показ подтверждения удаления комментария
function showDeleteCommentConfirmation(commentId) {
    deleteCommentId = commentId;
    deleteCommentModal.show();
}

// Подтверждение удаления комментария
async function confirmDeleteComment() {
    if (!deleteCommentId) return;
    
    try {
        // Отправляем запрос на удаление комментария
        await deleteComment(deleteCommentId);
        
        // Удаляем комментарий из локального списка
        callComments = callComments.filter(comment => comment.id !== deleteCommentId);
        
        // Обновляем отображение транскрипции с выделениями
        const transcriptText = document.getElementById('transcriptText');
        transcriptText.innerHTML = applyHighlightsToTranscript(transcriptText.textContent);
        
        // Добавляем обработчики событий для выделенных фрагментов
        addHighlightEventListeners();
        
        // Обновляем список комментариев
        renderCommentsList();
        
        // Закрываем модальное окно
        deleteCommentModal.hide();
        
        // Сбрасываем ID удаляемого комментария
        deleteCommentId = null;
        
        showNotification('info', 'Комментарий удален', 'Комментарий успешно удален');
        
    } catch (error) {
        console.error('Ошибка при удалении комментария:', error);
        showNotification('error', 'Ошибка', `Не удалось удалить комментарий: ${error.message}`);
        deleteCommentModal.hide();
    }
}

// Переход к выделенному тексту
function gotoHighlight(commentId) {
    // Переключаемся на вкладку транскрипции
    const transcriptTab = document.getElementById('transcript-tab');
    bootstrap.Tab.getOrCreateInstance(transcriptTab).show();
    
    // Находим выделенный текст и прокручиваем к нему
    const highlightElement = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (highlightElement) {
        highlightElement.classList.add('highlight-pulse');
        highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Удаляем класс анимации через 1 секунду
        setTimeout(() => {
            highlightElement.classList.remove('highlight-pulse');
        }, 1000);
    }
}

// Экспорт комментариев
function exportComments() {
    if (callComments.length === 0) {
        showNotification('warning', 'Внимание', 'Нет комментариев для экспорта');
        return;
    }
    
    // Создаем содержимое файла для экспорта
    let exportContent = `# Комментарии к звонку\n\n`;
    exportContent += `ID звонка: ${currentCallId}\n`;
    exportContent += `Дата экспорта: ${new Date().toLocaleString()}\n\n`;
    
    // Группируем комментарии по типу
    const goodComments = callComments.filter(c => c.type === 'good');
    const badComments = callComments.filter(c => c.type === 'bad');
    const noteComments = callComments.filter(c => c.type === 'note');
    
    // Добавляем хорошие примеры
    if (goodComments.length > 0) {
        exportContent += `## Хорошие примеры\n\n`;
        goodComments.forEach(comment => {
            exportContent += `- "${comment.text}"\n`;
            exportContent += `  *${comment.comment}*\n\n`;
        });
    }
    
    // Добавляем примеры, требующие улучшения
    if (badComments.length > 0) {
        exportContent += `## Требуют улучшения\n\n`;
        badComments.forEach(comment => {
            exportContent += `- "${comment.text}"\n`;
            exportContent += `  *${comment.comment}*\n\n`;
        });
    }
    
    // Добавляем заметки
    if (noteComments.length > 0) {
        exportContent += `## Заметки\n\n`;
        noteComments.forEach(comment => {
            exportContent += `- "${comment.text}"\n`;
            exportContent += `  *${comment.comment}*\n\n`;
        });
    }
    
    // Создаем ссылку для скачивания
    const blob = new Blob([exportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comments_${currentCallId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('success', 'Экспорт выполнен', 'Комментарии успешно экспортированы');
}

// Фильтрация комментариев по типу
function filterComments(type) {
    const commentCards = document.querySelectorAll('.comment-card');
    
    if (type === 'all') {
        // Показываем все комментарии
        commentCards.forEach(card => {
            card.classList.remove('d-none');
        });
    } else {
        // Показываем только комментарии выбранного типа
        commentCards.forEach(card => {
            if (card.classList.contains(`comment-${type}`)) {
                card.classList.remove('d-none');
            } else {
                card.classList.add('d-none');
            }
        });
    }
}

// Поиск в комментариях
function searchComments(query) {
    if (!query || query.trim() === '') {
        // Если запрос пустой, показываем все комментарии
        document.querySelectorAll('.comment-card').forEach(card => {
            card.classList.remove('d-none');
        });
        return;
    }
    
    // Приводим запрос к нижнему регистру для регистронезависимого поиска
    const normalizedQuery = query.toLowerCase().trim();
    
    // Проходим по всем комментариям и скрываем те, которые не соответствуют запросу
    document.querySelectorAll('.comment-card').forEach(card => {
        const commentText = card.querySelector('.blockquote p').textContent.toLowerCase();
        const commentNote = card.querySelector('.card-text').textContent.toLowerCase();
        
        if (commentText.includes(normalizedQuery) || commentNote.includes(normalizedQuery)) {
            card.classList.remove('d-none');
        } else {
            card.classList.add('d-none');
        }
    });
}