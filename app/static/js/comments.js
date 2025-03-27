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
    document.getElementById('enableSelectionBtn').addEventListener('click', toggleSelectionMode);
    document.getElementById('cancelSelectionBtn').addEventListener('click', cancelSelection);
    document.getElementById('cancelMomentBtn').addEventListener('click', cancelMomentForm);
    document.getElementById('saveMomentBtn').addEventListener('click', saveMoment);
    document.getElementById('confirmDeleteComment').addEventListener('click', confirmDeleteComment);
    document.getElementById('exportCommentsBtn').addEventListener('click', exportComments);
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

// ============= Функции для управления интерфейсом комментариев =============

// Отображение списка комментариев
function renderCommentsList() {
    const commentsList = document.getElementById('commentsList');
    const noCommentsMessage = document.getElementById('noCommentsMessage');
    
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
        }
        
        const commentDate = new Date(comment.created_at).toLocaleString();
        
        const card = document.createElement('div');
        card.className = `card comment-card ${cardClass} mb-3`;
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
                        <button class="btn btn-sm btn-outline-secondary goto-highlight-btn" data-comment-id="${comment.id}">
                            <i class="bi bi-search"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-comment-btn" data-comment-id="${comment.id}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="card-text mb-2">
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
        alert(`Ошибка при добавлении комментария: ${error.message}`);
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
        
    } catch (error) {
        console.error('Ошибка при удалении комментария:', error);
        alert(`Ошибка при удалении комментария: ${error.message}`);
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
        alert('Нет комментариев для экспорта');
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
}