// Базовый URL API
const API_BASE_URL = '/api';

// Получение элементов DOM
const uploadForm = document.getElementById('uploadForm');
const callsList = document.getElementById('callsList');
const refreshBtn = document.getElementById('refreshBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const loadingMessage = document.getElementById('loadingMessage');
const loadingDetails = document.getElementById('loadingDetails');
const progressModal = new bootstrap.Modal(document.getElementById('progressModal'));
let progressCheckInterval = null;
let currentCallId = null;
let processingStartTime = null;
// Модальное окно анализа
const analysisModal = new bootstrap.Modal(document.getElementById('analysisModal'));

// Функция для отображения загрузки
function showLoading(message, details = 'Пожалуйста, подождите') {
    loadingMessage.textContent = message;
    loadingDetails.textContent = details;
    loadingSpinner.classList.remove('hidden');
}

// Функция для скрытия загрузки
function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

// Функция для получения класса оценки
function getScoreClass(score) {
    if (score >= 9) return 'score-excellent';
    if (score >= 7) return 'score-good';
    if (score >= 5) return 'score-average';
    if (score >= 3) return 'score-below-average';
    return 'score-poor';
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

// Форматирование времени
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Функция для отображения анализа звонка
async function viewCallAnalysis(callId) {
    try {
        showLoading('Загрузка анализа', 'Получение данных...');
        
        const response = await fetch(`${API_BASE_URL}/calls/result/${callId}`);
        if (!response.ok) {
            throw new Error('Не удалось загрузить анализ звонка');
        }
        
        const analysis = await response.json();
        
        // Заполняем модальное окно
        
        // Общая оценка
        const overallScore = document.getElementById('overallScore');
        overallScore.textContent = analysis.score.overall.toFixed(1);
        overallScore.className = `score-badge ${getScoreClass(analysis.score.overall)}`;
        
        // Оценки по критериям
        const scoresList = document.getElementById('scoresList');
        scoresList.innerHTML = '';
        
        const scoreItems = [
            { key: 'script_adherence', name: 'Скрипт продаж' },
            { key: 'active_listening', name: 'Активное слушание' },
            { key: 'objection_handling', name: 'Работа с возражениями' },
            { key: 'sales_techniques', name: 'Техники продаж' },
            { key: 'communication_ethics', name: 'Этика общения' }
        ];
        
        scoreItems.forEach(item => {
            const scoreData = analysis.score[item.key];
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            listItem.innerHTML = `
                <div>
                    <strong>${item.name}</strong>
                    <p class="mb-0 small text-muted">${scoreData.comment}</p>
                </div>
                <span class="badge ${getScoreClass(scoreData.score)} rounded-pill">${scoreData.score.toFixed(1)}</span>
            `;
            scoresList.appendChild(listItem);
        });
        
        // Рекомендации
        const recommendationsList = document.getElementById('recommendationsList');
        recommendationsList.innerHTML = '';
        
        analysis.recommendations.forEach(recommendation => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';
            listItem.textContent = recommendation;
            recommendationsList.appendChild(listItem);
        });
        
        // Лучшие моменты
        const bestMomentsList = document.getElementById('bestMomentsList');
        bestMomentsList.innerHTML = '';
        
        analysis.best_moments.forEach(moment => {
            const card = document.createElement('div');
            card.className = 'card moment-card moment-good mb-3';
            card.innerHTML = `
                <div class="card-body">
                    <p class="card-text"><strong>"${moment.text}"</strong></p>
                    <p class="card-text text-muted"><small>${moment.comment}</small></p>
                </div>
            `;
            bestMomentsList.appendChild(card);
        });
        
        // Худшие моменты
        const worstMomentsList = document.getElementById('worstMomentsList');
        worstMomentsList.innerHTML = '';
        
        analysis.worst_moments.forEach(moment => {
            const card = document.createElement('div');
            card.className = 'card moment-card moment-bad mb-3';
            card.innerHTML = `
                <div class="card-body">
                    <p class="card-text"><strong>"${moment.text}"</strong></p>
                    <p class="card-text text-muted"><small>${moment.comment}</small></p>
                </div>
            `;
            worstMomentsList.appendChild(card);
        });
        
        // Анализ по этапам
        const stagesAccordion = document.getElementById('stagesAccordion');
        stagesAccordion.innerHTML = '';
        
        const stages = [
            { key: 'greeting', name: 'Приветствие' },
            { key: 'needs_identification', name: 'Выявление потребностей' },
            { key: 'presentation', name: 'Презентация' },
            { key: 'objection_handling', name: 'Работа с возражениями' },
            { key: 'closing', name: 'Закрытие сделки' }
        ];
        
        stages.forEach((stage, index) => {
            if (!analysis.analysis[stage.key]) return;
            
            const accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item';
            accordionItem.innerHTML = `
                <h2 class="accordion-header" id="heading${index}">
                    <button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}" aria-expanded="${index === 0}" aria-controls="collapse${index}">
                        ${stage.name}
                    </button>
                </h2>
                <div id="collapse${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" aria-labelledby="heading${index}" data-bs-parent="#stagesAccordion">
                    <div class="accordion-body">
                        ${analysis.analysis[stage.key]}
                    </div>
                </div>
            `;
            stagesAccordion.appendChild(accordionItem);
        });
        
        // Транскрипция
        document.getElementById('transcriptText').textContent = analysis.transcript;
        
        // Отображаем модальное окно
        hideLoading();
        analysisModal.show();
        
    } catch (error) {
        console.error('Ошибка при загрузке анализа:', error);
        alert(`Ошибка при загрузке анализа: ${error.message}`);
        hideLoading();
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

// Обработчик отправки формы загрузки
uploadForm.addEventListener('submit', async (e) => {
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
});


// Функция для форматирования времени в секундах
function formatElapsedTime(seconds) {
    if (seconds < 60) {
        return `${Math.floor(seconds)} секунд`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes} мин ${remainingSeconds} сек`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours} ч ${minutes} мин`;
    }
}

// Функция для отображения прогресса
function displayProgress(progress) {
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressStep = document.getElementById('progressStep');
    const progressLogs = document.getElementById('progressLogs');
    const processingTime = document.getElementById('processingTime');
    
    // Обновляем прогресс-бар
    const percent = progress.progress || 0;
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute('aria-valuenow', percent);
    progressPercent.textContent = `${percent}%`;
    
    // Обновляем текст статуса
    progressStep.textContent = progress.message || 'Обработка...';
    
    // Подсвечиваем прогресс-бар в зависимости от статуса
    progressBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
    if (progress.status === 'completed') {
        progressBar.classList.add('bg-success');
    } else if (progress.status === 'error') {
        progressBar.classList.add('bg-danger');
    } else {
        progressBar.classList.add('bg-primary');
    }
    
    // Обновляем время обработки
    if (processingStartTime) {
        const elapsedSeconds = (Date.now() - processingStartTime) / 1000;
        processingTime.textContent = formatElapsedTime(elapsedSeconds);
    }
    
    // Добавляем логи
    if (progress.logs && progress.logs.length > 0) {
        progressLogs.innerHTML = '';
        progress.logs.forEach(log => {
            const logLine = document.createElement('div');
            logLine.className = 'log-line';
            logLine.textContent = log;
            progressLogs.appendChild(logLine);
        });
        
        // Прокручиваем до последней записи
        progressLogs.scrollTop = progressLogs.scrollHeight;
    }
    
    // Если обработка завершена или произошла ошибка, останавливаем проверку
    if (progress.status === 'completed' || progress.status === 'error') {
        clearInterval(progressCheckInterval);
        progressCheckInterval = null;
        
        // Если обработка завершена успешно, перезагружаем список через 3 секунды
        if (progress.status === 'completed') {
            setTimeout(() => {
                loadCallsList();
            }, 3000);
        }
    }
}

// Функция для проверки прогресса
async function checkProgress(callId) {
    try {
        const response = await fetch(`${API_BASE_URL}/calls/progress/${callId}`);
        
        if (!response.ok) {
            throw new Error('Не удалось получить информацию о прогрессе');
        }
        
        const progress = await response.json();
        displayProgress(progress);
        
    } catch (error) {
        console.error('Ошибка при проверке прогресса:', error);
    }
}

// Функция для начала отслеживания прогресса
function startProgressTracking(callId) {
    currentCallId = callId;
    processingStartTime = Date.now();
    
    // Показываем модальное окно прогресса
    progressModal.show();
    
    // Инициализируем интерфейс
    const progressLogs = document.getElementById('progressLogs');
    progressLogs.innerHTML = '<div class="log-line">Инициализация анализа звонка...</div>';
    
    // Сбрасываем предыдущий интервал, если он был
    if (progressCheckInterval) {
        clearInterval(progressCheckInterval);
    }
    
    // Запускаем первую проверку сразу
    checkProgress(callId);
    
    // Запускаем периодическую проверку прогресса
    progressCheckInterval = setInterval(() => {
        checkProgress(callId);
    }, 2000); // Проверяем каждые 2 секунды
}

// Обновляем обработчик отправки формы загрузки
uploadForm.addEventListener('submit', async (e) => {
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
        
        // Скрываем индикатор загрузки
        hideLoading();
        
        // Запускаем отслеживание прогресса
        startProgressTracking(result.call_id);
        
        // Сбрасываем форму
        uploadForm.reset();
        
    } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        alert(`Ошибка при загрузке файла: ${error.message}`);
        hideLoading();
    }
});

// Добавляем обработчик закрытия модального окна прогресса
document.getElementById('progressModal').addEventListener('hidden.bs.modal', function () {
    // При закрытии окна останавливаем проверку прогресса
    if (progressCheckInterval) {
        clearInterval(progressCheckInterval);
        progressCheckInterval = null;
    }
    
    // Перезагружаем список звонков
    loadCallsList();
});


// Обработчик кнопки обновления
refreshBtn.addEventListener('click', loadCallsList);

// Добавьте эти функции в app/static/js/main.js

// Глобальные переменные для работы с комментариями
let currentCallId = null;
let momentCommentModal = null;
let currentMomentType = null; // 'best' или 'worst'
let currentMomentIndex = null; // Индекс момента для редактирования
let userComments = {}; // Объект для хранения комментариев пользователя

// Инициализация модальных окон и обработчиков событий
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация модального окна для комментариев к моментам
    momentCommentModal = new bootstrap.Modal(document.getElementById('momentCommentModal'));
    
    // Обработчики для кнопок добавления моментов
    document.getElementById('addBestMoment').addEventListener('click', () => addNewMoment('best'));
    document.getElementById('addWorstMoment').addEventListener('click', () => addNewMoment('worst'));
    
    // Обработчики для кнопок маркировки выделенного текста
    document.getElementById('markAsBest').addEventListener('click', () => markSelectedText('best'));
    document.getElementById('markAsWorst').addEventListener('click', () => markSelectedText('worst'));
    
    // Обработчик для сохранения комментария к моменту
    document.getElementById('saveMomentComment').addEventListener('click', saveMomentComment);
    
    // Обработчик для сохранения всех комментариев
    document.getElementById('saveAllComments').addEventListener('click', saveAllComments);
    
    // Обработчик для сохранения общего комментария
    document.getElementById('saveGeneralComment').addEventListener('click', saveGeneralComment);
});

// Функция для получения выделенного текста
function getSelectedText() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return '';
    return selection.toString();
}

// Функция для маркировки выделенного текста
function markSelectedText(type) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0 || selection.toString().trim() === '') {
        alert('Пожалуйста, выделите текст в транскрипции');
        return;
    }
    
    const selectedText = selection.toString();
    
    // Открываем модальное окно для добавления комментария
    document.getElementById('momentText').value = selectedText;
    document.getElementById('momentComment').value = '';
    document.getElementById('addToTraining').checked = false;
    
    currentMomentType = type;
    currentMomentIndex = null;
    
    document.getElementById('momentCommentTitle').textContent = 
        type === 'best' ? 'Добавить удачный момент' : 'Добавить неудачный момент';
    
    momentCommentModal.show();
}

// Функция для добавления нового момента без выделения
function addNewMoment(type) {
    document.getElementById('momentText').value = '';
    document.getElementById('momentComment').value = '';
    document.getElementById('addToTraining').checked = false;
    
    currentMomentType = type;
    currentMomentIndex = null;
    
    document.getElementById('momentCommentTitle').textContent = 
        type === 'best' ? 'Добавить удачный момент' : 'Добавить неудачный момент';
    
    momentCommentModal.show();
}

// Функция для сохранения комментария к моменту
function saveMomentComment() {
    const text = document.getElementById('momentText').value.trim();
    const comment = document.getElementById('momentComment').value.trim();
    const addToTraining = document.getElementById('addToTraining').checked;
    
    if (text === '') {
        alert('Пожалуйста, введите текст момента');
        return;
    }
    
    if (comment === '') {
        alert('Пожалуйста, добавьте комментарий');
        return;
    }
    
    // Создаем объект момента
    const moment = {
        text: text,
        comment: comment,
        added_by_user: true,
        add_to_training: addToTraining
    };
    
    // Инициализируем хранилище для текущего звонка, если его еще нет
    if (!userComments[currentCallId]) {
        userComments[currentCallId] = {
            best_moments: [],
            worst_moments: [],
            general_comment: ''
        };
    }
    
    // Добавляем или обновляем момент
    if (currentMomentIndex !== null) {
        userComments[currentCallId][currentMomentType === 'best' ? 'best_moments' : 'worst_moments'][currentMomentIndex] = moment;
    } else {
        userComments[currentCallId][currentMomentType === 'best' ? 'best_moments' : 'worst_moments'].push(moment);
    }
    
    // Обновляем отображение моментов
    if (currentMomentType === 'best') {
        updateBestMomentsList();
    } else {
        updateWorstMomentsList();
    }
    
    // Сохраняем в localStorage для временного хранения
    localStorage.setItem('userComments', JSON.stringify(userComments));
    
    // Закрываем модальное окно
    momentCommentModal.hide();
}

// Функция для отображения лучших моментов
function updateBestMomentsList() {
    const bestMomentsList = document.getElementById('bestMomentsList');
    const bestMoments = userComments[currentCallId]?.best_moments || [];
    
    // Сохраняем текущее содержимое
    const currentContent = bestMomentsList.innerHTML;
    
    // Обновляем с пользовательскими моментами
    bestMoments.forEach((moment, index) => {
        if (!moment.added_by_user) return;
        
        const card = document.createElement('div');
        card.className = 'card moment-card moment-good mb-3';
        card.innerHTML = `
            <div class="card-body">
                <div class="moment-actions">
                    <button class="btn btn-sm btn-outline-secondary edit-moment" data-type="best" data-index="${index}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-moment" data-type="best" data-index="${index}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <p class="card-text"><strong>"${moment.text}"</strong>${moment.add_to_training ? '<span class="training-badge">Обучение</span>' : ''}</p>
                <p class="card-text text-muted"><small>${moment.comment}</small></p>
                <div class="moment-user-comment">
                    <small><em>Ваш комментарий</em></small>
                </div>
            </div>
        `;
        bestMomentsList.appendChild(card);
        
        // Добавляем обработчики для кнопок редактирования и удаления
        card.querySelector('.edit-moment').addEventListener('click', (e) => {
            e.preventDefault();
            editMoment('best', index);
        });
        card.querySelector('.delete-moment').addEventListener('click', (e) => {
            e.preventDefault();
            deleteMoment('best', index);
        });
    });
}

// Функция для отображения худших моментов
function updateWorstMomentsList() {
    const worstMomentsList = document.getElementById('worstMomentsList');
    const worstMoments = userComments[currentCallId]?.worst_moments || [];
    
    // Сохраняем текущее содержимое
    const currentContent = worstMomentsList.innerHTML;
    
    // Обновляем с пользовательскими моментами
    worstMoments.forEach((moment, index) => {
        if (!moment.added_by_user) return;
        
        const card = document.createElement('div');
        card.className = 'card moment-card moment-bad mb-3';
        card.innerHTML = `
            <div class="card-body">
                <div class="moment-actions">
                    <button class="btn btn-sm btn-outline-secondary edit-moment" data-type="worst" data-index="${index}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-moment" data-type="worst" data-index="${index}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <p class="card-text"><strong>"${moment.text}"</strong>${moment.add_to_training ? '<span class="training-badge">Обучение</span>' : ''}</p>
                <p class="card-text text-muted"><small>${moment.comment}</small></p>
                <div class="moment-user-comment">
                    <small><em>Ваш комментарий</em></small>
                </div>
            </div>
        `;
        worstMomentsList.appendChild(card);
        
        // Добавляем обработчики для кнопок редактирования и удаления
        card.querySelector('.edit-moment').addEventListener('click', (e) => {
            e.preventDefault();
            editMoment('worst', index);
        });
        card.querySelector('.delete-moment').addEventListener('click', (e) => {
            e.preventDefault();
            deleteMoment('worst', index);
        });
    });
}

// Функция для редактирования момента
function editMoment(type, index) {
    const moments = userComments[currentCallId][type === 'best' ? 'best_moments' : 'worst_moments'];
    const moment = moments[index];
    
    document.getElementById('momentText').value = moment.text;
    document.getElementById('momentComment').value = moment.comment;
    document.getElementById('addToTraining').checked = moment.add_to_training;
    
    currentMomentType = type;
    currentMomentIndex = index;
    
    document.getElementById('momentCommentTitle').textContent = 
        type === 'best' ? 'Редактировать удачный момент' : 'Редактировать неудачный момент';
    
    momentCommentModal.show();
}

// Функция для удаления момента
function deleteMoment(type, index) {
    if (!confirm('Вы уверены, что хотите удалить этот момент?')) {
        return;
    }
    
    userComments[currentCallId][type === 'best' ? 'best_moments' : 'worst_moments'].splice(index, 1);
    
    // Обновляем отображение
    if (type === 'best') {
        updateBestMomentsList();
    } else {
        updateWorstMomentsList();
    }
    
    // Сохраняем в localStorage
    localStorage.setItem('userComments', JSON.stringify(userComments));
}

// Функция для сохранения общего комментария
function saveGeneralComment() {
    const comment = document.getElementById('generalComment').value.trim();
    
    if (!userComments[currentCallId]) {
        userComments[currentCallId] = {
            best_moments: [],
            worst_moments: [],
            general_comment: ''
        };
    }
    
    userComments[currentCallId].general_comment = comment;
    
    // Сохраняем в localStorage
    localStorage.setItem('userComments', JSON.stringify(userComments));
    
    // Показываем уведомление
    alert('Общий комментарий сохранен');
}

// Функция для сохранения всех комментариев на сервере
async function saveAllComments() {
    try {
        // Проверяем, есть ли комментарии для сохранения
        if (!userComments[currentCallId]) {
            alert('Нет комментариев для сохранения');
            return;
        }
        
        // Показываем индикатор загрузки
        showLoading('Сохранение комментариев', 'Отправка данных на сервер...');
        
        // Отправляем запрос на сервер
        const response = await fetch(`${API_BASE_URL}/calls/comments/${currentCallId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userComments[currentCallId])
        });
        
        if (!response.ok) {
            throw new Error('Не удалось сохранить комментарии');
        }
        
        hideLoading();
        alert('Комментарии успешно сохранены');
        
    } catch (error) {
        console.error('Ошибка при сохранении комментариев:', error);
        hideLoading();
        alert(`Ошибка при сохранении комментариев: ${error.message}`);
    }
}

// Обновляем функцию viewCallAnalysis для загрузки комментариев
async function viewCallAnalysis(callId) {
    try {
        showLoading('Загрузка анализа', 'Получение данных...');
        
        // Устанавливаем текущий ID звонка
        currentCallId = callId;
        
        // Загружаем комментарии из localStorage
        const savedComments = localStorage.getItem('userComments');
        if (savedComments) {
            userComments = JSON.parse(savedComments);
        } else {
            userComments = {};
        }
        
        // Если нет данных для текущего звонка, создаем пустую структуру
        if (!userComments[currentCallId]) {
            userComments[currentCallId] = {
                best_moments: [],
                worst_moments: [],
                general_comment: ''
            };
        }
        
        const response = await fetch(`${API_BASE_URL}/calls/result/${callId}`);
        if (!response.ok) {
            throw new Error('Не удалось загрузить анализ звонка');
        }
        
        const analysis = await response.json();
        
        // Заполняем модальное окно данными
        
        // Общая оценка
        const overallScore = document.getElementById('overallScore');
        overallScore.textContent = analysis.score.overall.toFixed(1);
        overallScore.className = `score-badge ${getScoreClass(analysis.score.overall)}`;
        
        // Заполняем общий комментарий, если он есть
        document.getElementById('generalComment').value = userComments[currentCallId].general_comment || '';
        
        // ... остальной код для заполнения модального окна ...
        // (сохраняем существующий код для отображения оценок, рекомендаций и т.д.)
        
        // Добавляем комментарии пользователя к уже существующим моментам
        updateBestMomentsList();
        updateWorstMomentsList();
        
        // Отображаем модальное окно
        hideLoading();
        const analysisModal = new bootstrap.Modal(document.getElementById('analysisModal'));
        analysisModal.show();
        
    } catch (error) {
        console.error('Ошибка при загрузке анализа:', error);
        alert(`Ошибка при загрузке анализа: ${error.message}`);
        hideLoading();
    }
}