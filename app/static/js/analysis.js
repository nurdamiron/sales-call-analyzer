// Глобальная переменная с текущим ID звонка
let currentCallId = null;

// Функция для отображения анализа звонка
async function viewCallAnalysis(callId) {
    try {
        showLoading('Загрузка анализа', 'Получение данных...');
        
        // Сохраняем текущий ID звонка
        currentCallId = callId;
        
        const response = await fetch(`${API_BASE_URL}/calls/result/${callId}`);
        if (!response.ok) {
            throw new Error('Не удалось загрузить анализ звонка');
        }
        
        const analysis = await response.json();
        
        // Обновляем заголовок модального окна
        document.getElementById('analysisModalTitle').textContent = 
            `Анализ звонка ${analysis.metadata?.agent_name ? `(${analysis.metadata.agent_name})` : ''}`;
        
        // Загружаем комментарии к звонку
        await loadCallComments(callId);
        
        // Заполняем данные анализа
        loadAnalysisSummary(analysis);
        
        // Заполняем транскрипцию с выделениями
        document.getElementById('transcriptText').innerHTML = applyHighlightsToTranscript(analysis.transcript);
        
        // После загрузки транскрипции добавляем обработчики событий для выделенных фрагментов
        addHighlightEventListeners();
        
        // Отображаем список комментариев
        renderCommentsList();
        
        // Отображаем модальное окно
        hideLoading();
        analysisModal.show();
        
    } catch (error) {
        console.error('Ошибка при загрузке анализа:', error);
        showNotification('error', 'Ошибка загрузки', `Не удалось загрузить анализ: ${error.message}`);
        hideLoading();
    }
}

// Функция для загрузки и отображения основных данных анализа
function loadAnalysisSummary(analysis) {
    // Общая оценка
    const overallScore = document.getElementById('overallScore');
    overallScore.textContent = analysis.score.overall.toFixed(1);
    overallScore.className = `score-badge ${getScoreClass(analysis.score.overall)}`;
    
    // Оценки по критериям
    loadScores(analysis.score);
    
    // Рекомендации
    loadRecommendations(analysis.recommendations);
    
    // Лучшие моменты
    loadBestMoments(analysis.best_moments);
    
    // Худшие моменты
    loadWorstMoments(analysis.worst_moments);
    
    // Анализ по этапам
    loadStagesAnalysis(analysis.analysis);
}

// Функция для загрузки оценок по критериям
function loadScores(score) {
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
        const scoreData = score[item.key];
        if (!scoreData) return;
        
        const scoreValue = scoreData.score || 0;
        const comment = scoreData.comment || '';
        
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item py-2';
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <strong>${item.name}</strong>
                <span class="badge ${getScoreClass(scoreValue)} rounded-pill">${scoreValue.toFixed(1)}</span>
            </div>
            <div class="progress" style="height: 4px;">
                <div class="progress-bar ${getScoreClass(scoreValue).replace('score-', 'bg-')}" 
                    role="progressbar" 
                    style="width: ${scoreValue * 10}%" 
                    aria-valuenow="${scoreValue}" 
                    aria-valuemin="0" 
                    aria-valuemax="10">
                </div>
            </div>
            <p class="mb-0 small text-muted mt-1">${comment}</p>
        `;
        scoresList.appendChild(listItem);
    });
}

// Функция для загрузки рекомендаций
function loadRecommendations(recommendations) {
    const recommendationsList = document.getElementById('recommendationsList');
    recommendationsList.innerHTML = '';
    
    if (!recommendations || recommendations.length === 0) {
        recommendationsList.innerHTML = `
            <li class="list-group-item py-3 text-center text-muted">
                <i class="bi bi-info-circle me-2"></i>Нет рекомендаций
            </li>
        `;
        return;
    }
    
    recommendations.forEach((recommendation, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item py-2';
        listItem.innerHTML = `
            <div class="d-flex">
                <div class="me-2 text-primary">
                    <i class="bi bi-lightbulb-fill"></i>
                </div>
                <div>${recommendation}</div>
            </div>
        `;
        recommendationsList.appendChild(listItem);
    });
}

// Функция для загрузки лучших моментов
function loadBestMoments(bestMoments) {
    const bestMomentsList = document.getElementById('bestMomentsList');
    bestMomentsList.innerHTML = '';
    
    if (!bestMoments || bestMoments.length === 0) {
        bestMomentsList.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-emoji-neutral display-6"></i>
                <p class="mt-2">Нет выделенных лучших моментов</p>
            </div>
        `;
        return;
    }
    
    bestMoments.forEach(moment => {
        const card = document.createElement('div');
        card.className = 'moment-card moment-good mb-3';
        card.innerHTML = `
            <div class="card-body">
                <p class="moment-text">"${moment.text}"</p>
                <p class="moment-comment">${moment.comment}</p>
                <div class="moment-actions">
                    <button class="btn btn-sm btn-outline-success add-to-highlights-btn" 
                            data-text="${encodeURIComponent(moment.text)}" 
                            data-comment="${encodeURIComponent(moment.comment)}"
                            data-type="good">
                        <i class="bi bi-plus-circle me-1"></i>Добавить в выделения
                    </button>
                </div>
            </div>
        `;
        bestMomentsList.appendChild(card);
    });
    
    // Добавляем обработчики событий для кнопок "Добавить в выделения"
    bestMomentsList.querySelectorAll('.add-to-highlights-btn').forEach(btn => {
        btn.addEventListener('click', addToHighlights);
    });
}

// Функция для загрузки худших моментов
function loadWorstMoments(worstMoments) {
    const worstMomentsList = document.getElementById('worstMomentsList');
    worstMomentsList.innerHTML = '';
    
    if (!worstMoments || worstMoments.length === 0) {
        worstMomentsList.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-emoji-smile display-6"></i>
                <p class="mt-2">Нет моментов требующих улучшения</p>
            </div>
        `;
        return;
    }
    
    worstMoments.forEach(moment => {
        const card = document.createElement('div');
        card.className = 'moment-card moment-bad mb-3';
        card.innerHTML = `
            <div class="card-body">
                <p class="moment-text">"${moment.text}"</p>
                <p class="moment-comment">${moment.comment}</p>
                <div class="moment-actions">
                    <button class="btn btn-sm btn-outline-danger add-to-highlights-btn" 
                            data-text="${encodeURIComponent(moment.text)}" 
                            data-comment="${encodeURIComponent(moment.comment)}"
                            data-type="bad">
                        <i class="bi bi-plus-circle me-1"></i>Добавить в выделения
                    </button>
                </div>
            </div>
        `;
        worstMomentsList.appendChild(card);
    });
    
    // Добавляем обработчики событий для кнопок "Добавить в выделения"
    worstMomentsList.querySelectorAll('.add-to-highlights-btn').forEach(btn => {
        btn.addEventListener('click', addToHighlights);
    });
}

// Функция для загрузки анализа по этапам
function loadStagesAnalysis(analysis) {
    const stagesAccordion = document.getElementById('stagesAccordion');
    stagesAccordion.innerHTML = '';
    
    if (!analysis) {
        stagesAccordion.innerHTML = `
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>Нет доступного анализа по этапам
            </div>
        `;
        return;
    }
    
    const stages = [
        { key: 'greeting', name: 'Приветствие', icon: 'bi-hand-wave' },
        { key: 'needs_identification', name: 'Выявление потребностей', icon: 'bi-search' },
        { key: 'presentation', name: 'Презентация', icon: 'bi-easel' },
        { key: 'objection_handling', name: 'Работа с возражениями', icon: 'bi-shield-check' },
        { key: 'closing', name: 'Закрытие сделки', icon: 'bi-check-circle' }
    ];
    
    stages.forEach((stage, index) => {
        if (!analysis[stage.key]) return;
        
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';
        accordionItem.innerHTML = `
            <h2 class="accordion-header" id="heading${index}">
                <button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" 
                        data-bs-toggle="collapse" 
                        data-bs-target="#collapse${index}" 
                        aria-expanded="${index === 0}" 
                        aria-controls="collapse${index}">
                    <i class="bi ${stage.icon} me-2"></i>
                    ${stage.name}
                </button>
            </h2>
            <div id="collapse${index}" 
                 class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                 aria-labelledby="heading${index}" 
                 data-bs-parent="#stagesAccordion">
                <div class="accordion-body">
                    ${analysis[stage.key]}
                </div>
            </div>
        `;
        stagesAccordion.appendChild(accordionItem);
    });
}

// Функция для добавления момента из карточки в выделения
function addToHighlights(event) {
    const btn = event.currentTarget;
    const text = decodeURIComponent(btn.getAttribute('data-text'));
    const comment = decodeURIComponent(btn.getAttribute('data-comment'));
    const type = btn.getAttribute('data-type');
    
    // Создаем новый комментарий
    const newComment = {
        id: Date.now().toString(), // Генерируем уникальный ID
        text: text,
        comment: comment,
        type: type,
        created_at: new Date().toISOString()
    };
    
    // Добавляем комментарий и обновляем интерфейс
    addNewComment(newComment)
        .then(() => {
            showNotification('success', 'Комментарий добавлен', 'Момент успешно добавлен в выделения');
        })
        .catch(error => {
            showNotification('error', 'Ошибка', `Не удалось добавить комментарий: ${error.message}`);
        });
}