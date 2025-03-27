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
        alert(`Ошибка при загрузке анализа: ${error.message}`);
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
}

// Функция для загрузки рекомендаций
function loadRecommendations(recommendations) {
    const recommendationsList = document.getElementById('recommendationsList');
    recommendationsList.innerHTML = '';
    
    recommendations.forEach(recommendation => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';
        listItem.textContent = recommendation;
        recommendationsList.appendChild(listItem);
    });
}

// Функция для загрузки лучших моментов
function loadBestMoments(bestMoments) {
    const bestMomentsList = document.getElementById('bestMomentsList');
    bestMomentsList.innerHTML = '';
    
    bestMoments.forEach(moment => {
        const card = document.createElement('div');
        card.className = 'card moment-card moment-good mb-3';
        card.innerHTML = `
            <div class="card-body">
                <p class="card-text"><strong>"${moment.text}"</strong></p>
                <p class="card-text text-muted"><small>${moment.comment}</small></p>
                <button class="btn btn-sm btn-outline-success add-to-highlights-btn" 
                        data-text="${encodeURIComponent(moment.text)}" 
                        data-comment="${encodeURIComponent(moment.comment)}"
                        data-type="good">
                    <i class="bi bi-plus-circle"></i> Добавить в выделения
                </button>
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
    
    worstMoments.forEach(moment => {
        const card = document.createElement('div');
        card.className = 'card moment-card moment-bad mb-3';
        card.innerHTML = `
            <div class="card-body">
                <p class="card-text"><strong>"${moment.text}"</strong></p>
                <p class="card-text text-muted"><small>${moment.comment}</small></p>
                <button class="btn btn-sm btn-outline-danger add-to-highlights-btn" 
                        data-text="${encodeURIComponent(moment.text)}" 
                        data-comment="${encodeURIComponent(moment.comment)}"
                        data-type="bad">
                    <i class="bi bi-plus-circle"></i> Добавить в выделения
                </button>
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
    
    const stages = [
        { key: 'greeting', name: 'Приветствие' },
        { key: 'needs_identification', name: 'Выявление потребностей' },
        { key: 'presentation', name: 'Презентация' },
        { key: 'objection_handling', name: 'Работа с возражениями' },
        { key: 'closing', name: 'Закрытие сделки' }
    ];
    
    stages.forEach((stage, index) => {
        if (!analysis[stage.key]) return;
        
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
    addNewComment(newComment);
}