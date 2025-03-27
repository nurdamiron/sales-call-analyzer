// Базовый URL API
const API_BASE_URL = '/api';

// Получение элементов DOM
const uploadForm = document.getElementById('uploadForm');
const callsList = document.getElementById('callsList');
const refreshBtn = document.getElementById('refreshBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const loadingMessage = document.getElementById('loadingMessage');
const loadingDetails = document.getElementById('loadingDetails');

// Модальное окно анализа
const analysisModal = new bootstrap.Modal(document.getElementById('analysisModal'));

// Инициализация приложения
// Проверка существования элементов DOM перед взаимодействием с ними
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация обработчиков только если элементы существуют
    const uploadForm = document.getElementById('uploadForm');
    const refreshBtn = document.getElementById('refreshBtn');

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
});
// Обертка для функции showLoading, чтобы избежать ошибок
function showLoading(message, details = 'Пожалуйста, подождите') {
    const loadingMessage = document.getElementById('loadingMessage');
    const loadingDetails = document.getElementById('loadingDetails');
    const loadingSpinner = document.getElementById('loadingSpinner');
    
    if (loadingMessage) loadingMessage.textContent = message;
    if (loadingDetails) loadingDetails.textContent = details;
    if (loadingSpinner) loadingSpinner.classList.remove('hidden');
}

// Обертка для функции hideLoading, чтобы избежать ошибок
function hideLoading() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
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

// Обработчик отправки формы загрузки
async function uploadCall(e) {
    e.preventDefault();
    
    const callFile = document.getElementById('callFile').files[0];
    if (!callFile) {
        alert('Пожалуйста, выберите файл звонка');
        return;
    }
    
    try {
        showLoading('Загрузка звонка', 'Отправка файла...');
        
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
        
        showLoading('Анализ звонка', 'Это может занять несколько минут...');
        
        // Периодически проверяем статус
        const checkInterval = setInterval(async () => {
            const status = await checkAnalysisStatus(result.call_id);
            
            if (status === 'completed') {
                clearInterval(checkInterval);
                hideLoading();
                loadCallsList();
                alert('Анализ звонка успешно завершен!');
            } else if (status === 'error') {
                clearInterval(checkInterval);
                hideLoading();
                alert('Произошла ошибка при анализе звонка.');
            }
            // Если status === 'processing' или 'waiting', продолжаем ожидание
        }, 5000); // Проверяем каждые 5 секунд
        
        // Сбрасываем форму
        uploadForm.reset();
        
    } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        alert(`Ошибка при загрузке файла: ${error.message}`);
        hideLoading();
    }
}

// Функция для проверки статуса анализа
async function checkAnalysisStatus(callId) {
    try {
        const statusResponse = await fetch(`${API_BASE_URL}/calls/status/${callId}`);
        
        if (!statusResponse.ok) {
            if (statusResponse.status === 404) {
                // Анализ не найден, возможно, ещё не начался
                return 'waiting';
            }
            throw new Error('Не удалось получить статус анализа');
        }
        
        const status = await statusResponse.json();
        return status.status;
    } catch (error) {
        console.error('Ошибка при проверке статуса:', error);
        return 'error';
    }
}

// Функция для загрузки списка звонков
async function loadCallsList() {
    try {
        const response = await fetch(`${API_BASE_URL}/calls`);
        if (!response.ok) {
            throw new Error('Не удалось загрузить список звонков');
        }
        
        const calls = await response.json();
        
        // Обновляем список
        callsList.innerHTML = '';
        
        if (calls.length === 0) {
            callsList.innerHTML = `
                <div class="col-12 text-center py-3">
                    <p class="mb-0">Нет проанализированных звонков</p>
                </div>
            `;
            return;
        }
        
        // Отображаем звонки
        calls.forEach(call => {
            const scoreClass = getScoreClass(call.overall_score);
            const card = document.createElement('div');
            card.className = 'col-md-4 mb-4';
            card.innerHTML = `
                <div class="card call-card h-100">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h6 class="mb-0">${call.agent_name || 'Неизвестный продажник'}</h6>
                        <div class="score-badge ${scoreClass}">${call.overall_score.toFixed(1)}</div>
                    </div>
                    <div class="card-body">
                        <p class="text-muted mb-2">
                            <small>Дата: ${new Date(call.created_at).toLocaleDateString()}</small>
                        </p>
                        <p class="text-muted mb-2">
                            <small>Длительность: ${formatDuration(call.duration || 0)}</small>
                        </p>
                        <p class="text-muted">
                            <small>Файл: ${call.file_name}</small>
                        </p>
                    </div>
                    <div class="card-footer d-flex justify-content-between">
                        <button class="btn btn-sm btn-primary view-btn" data-call-id="${call.call_id}">
                            <i class="bi bi-eye"></i> Просмотр
                        </button>
                        <button class="btn btn-sm btn-danger delete-btn" data-call-id="${call.call_id}">
                            <i class="bi bi-trash"></i> Удалить
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
            <div class="col-12 text-center py-3">
                <p class="text-danger mb-0">Ошибка при загрузке звонков: ${error.message}</p>
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
        loadCallsList(); // Перезагружаем список
        
    } catch (error) {
        console.error('Ошибка при удалении звонка:', error);
        alert(`Ошибка при удалении звонка: ${error.message}`);
        hideLoading();
    }
}