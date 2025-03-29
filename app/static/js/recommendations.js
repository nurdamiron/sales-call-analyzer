// app/static/js/recommendations.js
// Файл для работы с рекомендациями

// Функция для отображения рекомендаций
function renderRecommendations(worstMoments) {
    const recommendationsContainer = document.getElementById('recommendationsContainer');
    if (!recommendationsContainer) return;
    
    recommendationsContainer.innerHTML = '';
    
    if (!worstMoments || worstMoments.length === 0) {
        recommendationsContainer.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-emoji-smile display-6"></i>
                <p class="mt-3">Нет моментов, требующих улучшения</p>
            </div>
        `;
        return;
    }
    
    // Фильтруем моменты с рекомендациями
    const momentsWithRecommendations = worstMoments.filter(moment => moment.recommendation);
    
    if (momentsWithRecommendations.length === 0) {
        recommendationsContainer.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-info-circle display-6"></i>
                <p class="mt-3">Проблемные моменты найдены, но конкретные рекомендации отсутствуют</p>
            </div>
        `;
        return;
    }
    
    // Создаем элементы для каждой рекомендации
    momentsWithRecommendations.forEach((moment, index) => {
        const recommendationItem = document.createElement('div');
        recommendationItem.className = 'recommendation-item mb-4';
        recommendationItem.innerHTML = `
            <div class="recommendation-problem p-3 rounded mb-2">
                <div class="d-flex justify-content-between mb-2">
                    <span class="badge bg-danger">Проблемный момент</span>
                    <button class="btn btn-sm btn-outline-secondary goto-moment-btn" data-text="${encodeURIComponent(moment.text)}">
                        <i class="bi bi-search"></i> Найти в диалоге
                    </button>
                </div>
                <p class="fst-italic mb-2">"${moment.text}"</p>
                <p class="text-muted mb-0">${moment.comment}</p>
            </div>
            
            <div class="recommendation-solution p-3 rounded">
                <div class="d-flex justify-content-between mb-2">
                    <span class="badge bg-success">Рекомендуемый вариант</span>
                    <button class="btn btn-sm btn-outline-success copy-recommendation-btn" data-recommendation="${encodeURIComponent(moment.recommendation)}">
                        <i class="bi bi-clipboard"></i> Копировать
                    </button>
                </div>
                <p class="fw-medium mb-2">"${moment.recommendation}"</p>
                <p class="text-success mb-0">Более эффективная альтернатива</p>
            </div>
        `;
        
        recommendationsContainer.appendChild(recommendationItem);
    });
    
    // Добавляем обработчики событий
    recommendationsContainer.querySelectorAll('.goto-moment-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const text = decodeURIComponent(btn.getAttribute('data-text'));
            findAndHighlightInTranscript(text);
        });
    });
    
    recommendationsContainer.querySelectorAll('.copy-recommendation-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const recommendation = decodeURIComponent(btn.getAttribute('data-recommendation'));
            navigator.clipboard.writeText(recommendation)
                .then(() => {
                    // Показываем уведомление об успешном копировании
                    showNotification('success', 'Скопировано', 'Рекомендация скопирована в буфер обмена');
                    
                    // Анимация кнопки
                    btn.innerHTML = '<i class="bi bi-check"></i> Скопировано';
                    setTimeout(() => {
                        btn.innerHTML = '<i class="bi bi-clipboard"></i> Копировать';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Ошибка при копировании: ', err);
                    showNotification('error', 'Ошибка', 'Не удалось скопировать текст');
                });
        });
    });
}

// Функция для экспорта рекомендаций
function exportRecommendations(worstMoments) {
    if (!worstMoments || worstMoments.length === 0) {
        showNotification('warning', 'Экспорт невозможен', 'Нет рекомендаций для экспорта');
        return;
    }
    
    // Фильтруем моменты с рекомендациями
    const momentsWithRecommendations = worstMoments.filter(moment => moment.recommendation);
    
    if (momentsWithRecommendations.length === 0) {
        showNotification('warning', 'Экспорт невозможен', 'Нет конкретных рекомендаций для экспорта');
        return;
    }
    
    // Создаем содержимое экспорта в формате Markdown
    let exportContent = `# Рекомендации по улучшению звонка\n\n`;
    exportContent += `Дата: ${new Date().toLocaleDateString()}\n\n`;
    
    exportContent += `## Проблемные моменты и рекомендации\n\n`;
    
    momentsWithRecommendations.forEach((moment, index) => {
        exportContent += `### Проблема ${index + 1}\n\n`;
        exportContent += `**Что было сказано:**\n\n> "${moment.text}"\n\n`;
        exportContent += `**Почему это проблема:**\n\n${moment.comment}\n\n`;
        exportContent += `**Рекомендация:**\n\n> "${moment.recommendation}"\n\n`;
        exportContent += `---\n\n`;
    });
    
    // Создаем ссылку для скачивания файла
    const blob = new Blob([exportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recommendations_${currentCallId || 'call'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('success', 'Экспорт выполнен', 'Рекомендации успешно экспортированы');
}

// Функция для поиска и подсветки текста в транскрипции
function findAndHighlightInTranscript(text) {
    // Переключаемся на вкладку транскрипции
    const transcriptTab = document.getElementById('transcript-tab');
    bootstrap.Tab.getOrCreateInstance(transcriptTab).show();
    
    // Переключаемся на режим "текст" вместо диалога, если такая функция существует
    if (typeof toggleViewMode === 'function') {
        toggleViewMode('raw');
    }
    
    // Находим текст в транскрипции
    const transcriptText = document.getElementById('transcriptText');
    if (!transcriptText) return;
    
    const content = transcriptText.innerHTML;
    
    // Ищем текст, который может быть внутри тегов highlight
    const plainText = transcriptText.textContent;
    const textIndex = plainText.indexOf(text);
    
    if (textIndex === -1) {
        showNotification('warning', 'Текст не найден', 'Не удалось найти указанный текст в транскрипции');
        return;
    }
    
    // Получаем примерное положение в элементе
    const approximatePosition = content.indexOf(text.substring(0, 20));
    
    if (approximatePosition === -1) {
        // Если не нашли напрямую, ищем внутри highlight
        const highlightElements = transcriptText.querySelectorAll('.highlight-good, .highlight-bad, .highlight-note');
        
        let foundElement = null;
        highlightElements.forEach(element => {
            if (element.textContent === text) {
                foundElement = element;
            }
        });
        
        if (foundElement) {
            // Прокручиваем к найденному элементу
            foundElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Подсвечиваем элемент
            foundElement.classList.add('highlight-pulse');
            setTimeout(() => {
                foundElement.classList.remove('highlight-pulse');
            }, 2000);
        } else {
            showNotification('warning', 'Текст не найден', 'Не удалось найти указанный текст в транскрипции');
        }
    } else {
        // Прокручиваем к найденному тексту
        const textNode = document.createRange();
        const selection = window.getSelection();
        
        try {
            // Пытаемся найти и выделить текст
            let childNode = transcriptText;
            let offset = approximatePosition;
            
            // Создаем временный диапазон
            textNode.setStart(childNode, 0);
            textNode.setEnd(childNode, childNode.childNodes.length);
            
            // Временное выделение
            selection.removeAllRanges();
            selection.addRange(textNode);
            
            // Прокручиваем к выделенному тексту
            const range = selection.getRangeAt(0);
            range.setStart(childNode, approximatePosition);
            range.setEnd(childNode, approximatePosition + text.length);
            
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Прокручиваем к выделенному тексту
            if (range) {
                const rect = range.getBoundingClientRect();
                const container = transcriptText.parentElement;
                container.scrollTop = rect.top - container.offsetTop - container.clientHeight / 2;
            }
            
            // Создаем временный элемент для подсветки
            const tempHighlight = document.createElement('span');
            tempHighlight.className = 'highlight-pulse';
            tempHighlight.textContent = text;
            
            range.deleteContents();
            range.insertNode(tempHighlight);
            
            // Удаляем временную подсветку через 2 секунды
            setTimeout(() => {
                const parent = tempHighlight.parentNode;
                while (tempHighlight.firstChild) {
                    parent.insertBefore(tempHighlight.firstChild, tempHighlight);
                }
                parent.removeChild(tempHighlight);
            }, 2000);
            
        } catch (e) {
            console.error('Ошибка при подсветке текста:', e);
            
            // Просто прокручиваем к приблизительной позиции
            transcriptText.scrollTop = approximatePosition / transcriptText.textContent.length * transcriptText.scrollHeight;
        }
    }
}

// Добавляем обработчики событий, когда DOM загружен
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем обработчик для кнопки экспорта рекомендаций
    const exportRecommendationsBtn = document.getElementById('exportRecommendationsBtn');
    if (exportRecommendationsBtn) {
        exportRecommendationsBtn.addEventListener('click', function() {
            // Используем текущие worstMoments, если они доступны через глобальную переменную
            if (typeof currentAnalysis !== 'undefined' && currentAnalysis && currentAnalysis.worst_moments) {
                exportRecommendations(currentAnalysis.worst_moments);
            } else {
                showNotification('warning', 'Данные недоступны', 'Не удалось получить данные для экспорта');
            }
        });
    }
});

// Глобальная переменная для хранения текущего анализа
let currentAnalysis = null;

// Модифицируем существующую функцию loadAnalysisSummary в analysis.js
// Эту функцию нужно будет модифицировать в существующем файле
/*
function loadAnalysisSummary(analysis) {
    // Сохраняем анализ в глобальной переменной
    currentAnalysis = analysis;
    
    // ... существующий код ...
    
    // Добавляем вызов функции для рендеринга рекомендаций
    renderRecommendations(analysis.worst_moments);
}
*/