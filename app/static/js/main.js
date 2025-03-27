// Базовый URL API
const API_BASE_URL = '/api';

// Переменные состояния
let isUploading = false;
let uploadProgress = { callId: null, interval: null };

// Получение элементов DOM
const uploadForm = document.getElementById('uploadForm');
const callsList = document.getElementById('callsList');
const refreshBtn = document.getElementById('refreshBtn');
const loadingSpinner = document.getElementById('loadingSpinner');

// Модальное окно анализа
const analysisModal = new bootstrap.Modal(document.getElementById('analysisModal'));

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация обработчиков
    if (uploadForm) {
        uploadForm.addEventListener('submit', uploadCall);
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadCallsList);
    }
    
    // Загрузка списка звонков
    loadCallsList();
    
    // Инициализация комментариев если доступно
    if (typeof initComments === 'function') {
        initComments();
    }
    
    // Инициализация нотификаций если доступно
    if (typeof initNotifications === 'function') {
        initNotifications();
    }
});

// Функция для отображения спиннера загрузки
function showLoading(message, details = 'Пожалуйста, подождите') {
    if (loadingSpinner) {
        document.getElementById('loadingMessage').textContent = message;
        document.getElementById('loadingDetails').textContent = details;
        loadingSpinner.classList.add('show');
    }
}

// Функция для скрытия спиннера загрузки
function hideLoading() {
    if (loadingSpinner) {
        loadingSpinner.classList.remove('show');
    }
}

// Функция для получения класса оценки
function getScoreClass(score) {
    if (score >= 9) return 'score-excellent';
    if (score >= 7) return 'score-good';
    if (score >= 5) return 'score-average';
    if (score >= 3) return 'score-below-average';
    return 'score-poor';
}

// Форматирование времени
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Форматирование даты
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('ru-RU', options);
}

// Обработчик отправки формы загрузки

// Обработчик отправки формы загрузки
async function uploadCall(e) {
    e.preventDefault();
    
    if (isUploading) {
        showNotification('warning', 'Загрузка уже идет', 'Дождитесь завершения текущей загрузки');
        return;
    }
    
    const callFile = document.getElementById('callFile').files[0];
    if (!callFile) {
        showNotification('error', 'Ошибка', 'Пожалуйста, выберите файл звонка');
        return;
    }
    
    try {
        isUploading = true;
        showNotification('info', 'Начало загрузки', 'Файл звонка отправляется на сервер');
        
        // Формируем данные для отправки
        const formData = new FormData();
        formData.append('file', callFile);
        
        // Добавляем метаданные
        const metadata = {
            agent_name: document.getElementById('agentName').value.trim(),
            client_id: document.getElementById('clientId').value.trim(),
            notes: document.getElementById('callNotes').value.trim()
        };
        
        formData.append('call_data', JSON.stringify(metadata));
        
        // Отправляем запрос
        const response = await fetch(`${API_BASE_URL}/calls/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Не удалось загрузить файл');
        }
        
        const result = await response.json();
        
        // Показываем прогресс анализа и запускаем трекер
        ProgressTracker.startTracking(result.call_id);
        
        // Сбрасываем форму
        uploadForm.reset();
        
        // Показываем уведомление
        showNotification('success', 'Файл загружен', 'Начинаем анализ звонка');
        
    } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        showNotification('error', 'Ошибка загрузки', error.message);
        isUploading = false;
    }
}

// Функция для отслеживания прогресса анализа
function startProgressTracking(callId) {
    // Очищаем предыдущий интервал, если он был
    if (uploadProgress.interval) {
        clearInterval(uploadProgress.interval);
    }
    
    // Создаем новый интервал для проверки прогресса
    uploadProgress.interval = setInterval(async () => {
        try {
            // Получаем информацию о прогрессе
            const progressResponse = await fetch(`${API_BASE_URL}/calls/progress/${callId}`);
            if (!progressResponse.ok) {
                throw new Error('Не удалось получить информацию о прогрессе');
            }
            
            const progressData = await progressResponse.json();
            
            // Обновляем отображение прогресса
            updateProgressDisplay(progressData);
            
            // Проверяем статус
            if (progressData.status === 'completed') {
                // Анализ завершен
                clearInterval(uploadProgress.interval);
                uploadProgress.interval = null;
                uploadProgress.callId = null;
                
                hideLoading();
                showNotification('success', 'Анализ завершен', 'Звонок успешно проанализирован');
                loadCallsList();
                isUploading = false;
            } else if (progressData.status === 'error') {
                // Произошла ошибка
                clearInterval(uploadProgress.interval);
                uploadProgress.interval = null;
                uploadProgress.callId = null;
                
                hideLoading();
                showNotification('error', 'Ошибка анализа', progressData.message || 'Произошла ошибка при анализе звонка');
                isUploading = false;
            }
            
        } catch (error) {
            console.error('Ошибка при проверке прогресса:', error);
        }
    }, 3000); // Проверяем каждые 3 секунды
}

// Функция для обновления отображения прогресса
function updateProgressDisplay(progressData) {
    const loadingMessage = document.getElementById('loadingMessage');
    const loadingDetails = document.getElementById('loadingDetails');
    
    if (loadingMessage && loadingDetails) {
        // Обновляем основной текст
        loadingMessage.textContent = progressData.message || 'Анализ звонка...';
        
        // Генерируем детали из последних логов
        if (progressData.logs && progressData.logs.length > 0) {
            // Берем последний лог
            const lastLog = progressData.logs[progressData.logs.length - 1];
            loadingDetails.textContent = lastLog;
        } else {
            loadingDetails.textContent = `Прогресс: ${progressData.progress}%`;
        }
    }
}

// Функция для загрузки списка звонков
async function loadCallsList() {
    try {
        // Показываем состояние загрузки
        callsList.innerHTML = `
            <div class="col-12 text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Загрузка...</span>
                </div>
                <p class="mt-3">Загрузка списка звонков...</p>
            </div>
        `;
        
        const response = await fetch(`${API_BASE_URL}/calls`);
        if (!response.ok) {
            throw new Error('Не удалось загрузить список звонков');
        }
        
        const calls = await response.json();
        
        // Обновляем список
        callsList.innerHTML = '';
        
        if (calls.length === 0) {
            callsList.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="empty-state">
                        <i class="bi bi-mic-mute display-4 text-muted"></i>
                        <h4 class="mt-3">Нет проанализированных звонков</h4>
                        <p class="text-muted">Загрузите звонок для анализа, используя форму выше</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Отображаем звонки
        calls.forEach(call => {
            const scoreClass = getScoreClass(call.overall_score);
            const formattedDate = formatDate(call.created_at);
            const card = document.createElement('div');
            card.className = 'col-md-4 col-sm-6';
            card.innerHTML = `
                <div class="card call-card h-100">
                    <div class="card-header">
                        <div class="fw-500">${call.agent_name || 'Неизвестный продажник'}</div>
                        <div class="score-badge ${scoreClass}">${call.overall_score.toFixed(1)}</div>
                    </div>
                    <div class="card-body">
                        <div class="call-info mb-3">
                            <div class="call-info-item">
                                <i class="bi bi-calendar-event"></i>
                                ${formattedDate}
                            </div>
                            <div class="call-info-item">
                                <i class="bi bi-clock"></i>
                                ${formatDuration(call.duration || 0)}
                            </div>
                            <div class="call-info-item" title="${call.file_name}">
                                <i class="bi bi-file-earmark-music"></i>
                                ${call.file_name.length > 25 ? call.file_name.substring(0, 22) + '...' : call.file_name}
                            </div>
                        </div>
                        <div class="score-summary">
                            <div class="progress mb-2">
                                <div class="progress-bar ${scoreClass.replace('score-', 'bg-')}" 
                                    role="progressbar" 
                                    style="width: ${call.overall_score * 10}%" 
                                    aria-valuenow="${call.overall_score}" 
                                    aria-valuemin="0" 
                                    aria-valuemax="10">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer d-flex justify-content-between">
                        <button class="btn btn-sm btn-primary view-btn" data-call-id="${call.call_id}">
                            <i class="bi bi-eye me-1"></i> Просмотр
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-btn" data-call-id="${call.call_id}">
                            <i class="bi bi-trash me-1"></i> Удалить
                        </button>
                    </div>
                </div>
            `;
            callsList.appendChild(card);
            
            // Добавляем обработчики событий
            const viewBtn = card.querySelector('.view-btn');
            viewBtn.addEventListener('click', () => viewCallAnalysis(call.call_id));
            
            const deleteBtn = card.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => deleteCall(call.call_id));
        });
        
    } catch (error) {
        console.error('Ошибка при загрузке звонков:', error);
        callsList.innerHTML = `
            <div class="col-12 py-4">
                <div class="alert alert-danger mb-0">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i>
                    Ошибка при загрузке звонков: ${error.message}
                    <button class="btn btn-sm btn-outline-danger ms-3" onclick="loadCallsList()">
                        <i class="bi bi-arrow-clockwise me-1"></i>Повторить
                    </button>
                </div>
            </div>
        `;
    }
}

// Функция для удаления звонка
async function deleteCall(callId) {
    if (!confirm('Вы уверены, что хотите удалить этот звонок?')) {
        return;
    }
    
    try {
        showLoading('Удаление звонка', 'Пожалуйста, подождите...');
        
        const response = await fetch(`${API_BASE_URL}/calls/${callId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Не удалось удалить звонок');
        }
        
        hideLoading();
        showNotification('info', 'Звонок удален', 'Звонок был успешно удален');
        loadCallsList(); // Перезагружаем список
        
    } catch (error) {
        console.error('Ошибка при удалении звонка:', error);
        hideLoading();
        showNotification('error', 'Ошибка удаления', error.message);
    }
}