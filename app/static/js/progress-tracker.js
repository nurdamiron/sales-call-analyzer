// Добавьте этот код в новый файл app/static/js/progress-tracker.js

// Объект состояния прогресса
const ProgressTracker = {
    currentCallId: null,
    intervalId: null,
    stepMapping: {
      'initialization': 'upload',
      'file_processing': 'upload',
      'transcription_start': 'transcription',
      'transcription': 'transcription',
      'analysis_start': 'analysis',
      'analysis': 'analysis',
      'finalizing': 'completion',
      'completed': 'completion'
    },
    autoScroll: true,
    
    // Инициализация трекера
    init() {
      // Привязка элементов UI
      const cancelBtn = document.getElementById('cancelAnalysisBtn');
      const autoScrollCheckbox = document.getElementById('autoScrollLogs');
      
      if (cancelBtn) {
        cancelBtn.addEventListener('click', this.cancelAnalysis.bind(this));
      }
      
      if (autoScrollCheckbox) {
        autoScrollCheckbox.addEventListener('change', (e) => {
          this.autoScroll = e.target.checked;
        });
      }
    },
    
    // Запуск отслеживания
    startTracking(callId) {
      // Показываем контейнер
      const container = document.getElementById('analysisProgressContainer');
      if (container) {
        container.style.display = 'block';
        
        // Прокручиваем к нему
        container.scrollIntoView({ behavior: 'smooth' });
      }
      
      // Очищаем логи
      const logsList = document.getElementById('logsList');
      if (logsList) {
        logsList.innerHTML = '';
      }
      
      // Сбрасываем прогресс-бар
      const progressBar = document.getElementById('progressBar');
      if (progressBar) {
        progressBar.style.width = '0%';
      }
      
      // Устанавливаем ID звонка и запускаем интервал проверки
      this.currentCallId = callId;
      this.checkProgress();
      
      // Устанавливаем интервал проверки
      this.intervalId = setInterval(() => {
        this.checkProgress();
      }, 2000); // Проверяем каждые 2 секунды
    },
    
    // Проверка прогресса
    async checkProgress() {
      if (!this.currentCallId) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/calls/progress/${this.currentCallId}`);
        if (!response.ok) {
          throw new Error('Не удалось получить информацию о прогрессе');
        }
        
        const data = await response.json();
        this.updateProgressUI(data);
        
        // Если анализ завершен или произошла ошибка, останавливаем отслеживание
        if (data.status === 'completed' || data.status === 'error') {
          this.stopTracking(data.status === 'completed');
        }
      } catch (error) {
        console.error('Ошибка при проверке прогресса:', error);
      }
    },
    
    // Обновление UI на основе данных прогресса
    updateProgressUI(data) {
      // Обновляем заголовок и описание
      const progressTitle = document.getElementById('progressTitle');
      const progressDescription = document.getElementById('progressDescription');
      const progressPercentage = document.getElementById('progressPercentage');
      const progressBar = document.getElementById('progressBar');
      
      if (progressTitle) progressTitle.textContent = data.message || 'Анализ звонка...';
      if (progressDescription) progressDescription.textContent = data.current_step || 'В процессе...';
      
      // Обновляем прогресс-бар
      if (progressPercentage) progressPercentage.textContent = `${data.progress}%`;
      if (progressBar) progressBar.style.width = `${data.progress}%`;
      
      // Обновляем шаги
      this.updateSteps(data.current_step);
      
      // Обновляем лог
      this.updateLogs(data.logs);
    },
    
    // Обновление визуального отображения шагов
    updateSteps(currentStep) {
      if (!currentStep) return;
      
      // Преобразуем текущий шаг в один из основных этапов
      const mainStep = this.stepMapping[currentStep] || 'upload';
      
      // Этапы в порядке выполнения
      const steps = ['upload', 'transcription', 'analysis', 'completion'];
      
      // Находим индекс текущего шага
      const currentIndex = steps.indexOf(mainStep);
      
      // Обновляем классы для всех шагов
      steps.forEach((step, index) => {
        const stepEl = document.getElementById(`step-${step}`);
        if (!stepEl) return;
        
        // Очищаем предыдущие классы
        stepEl.classList.remove('active', 'completed');
        
        // Устанавливаем соответствующий класс
        if (index < currentIndex) {
          stepEl.classList.add('completed');
        } else if (index === currentIndex) {
          stepEl.classList.add('active');
        }
      });
      
      // Обновляем линии между шагами
      steps.forEach((step, index) => {
        if (index === steps.length - 1) return; // Последний шаг не имеет линии справа
        
        const stepEl = document.getElementById(`step-${step}`);
        if (!stepEl) return;
        
        // Находим линию справа от текущего шага (она следует за элементом шага)
        const lineEl = stepEl.nextElementSibling;
        if (!lineEl || !lineEl.classList.contains('step-line')) return;
        
        // Очищаем предыдущий класс
        lineEl.classList.remove('active');
        
        // Активируем линию, если предыдущий шаг завершен
        if (index < currentIndex) {
          lineEl.classList.add('active');
        }
      });
    },
    
    // Обновление логов
    updateLogs(logs) {
      if (!logs || !logs.length) return;
      
      const logsList = document.getElementById('logsList');
      if (!logsList) return;
      
      // Текущее количество логов
      const currentLogsCount = logsList.children.length;
      
      // Если есть новые логи, добавляем их
      if (logs.length > currentLogsCount) {
        for (let i = currentLogsCount; i < logs.length; i++) {
          const log = logs[i];
          
          // Создаем новый элемент лога
          const logEntry = document.createElement('div');
          logEntry.className = 'log-entry log-highlight';
          
          // Создаем метку времени
          const timestamp = new Date().toLocaleTimeString();
          
          // Добавляем содержимое
          logEntry.innerHTML = `
            <span class="log-timestamp">[${timestamp}]</span>
            <span class="log-message">${log}</span>
          `;
          
          // Добавляем в список
          logsList.appendChild(logEntry);
          
          // Если включена автопрокрутка, прокручиваем к новому логу
          if (this.autoScroll) {
            const logsContainer = logsList.parentElement;
            if (logsContainer) {
              logsContainer.scrollTop = logsContainer.scrollHeight;
            }
          }
        }
      }
    },
    
    // Остановка отслеживания
    stopTracking(isSuccess) {
      // Очищаем интервал
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      
      // Сбрасываем ID текущего звонка
      this.currentCallId = null;
      
      // Если успешно, обновляем список звонков и скрываем контейнер прогресса
      if (isSuccess) {
        setTimeout(() => {
          loadCallsList(); // Обновляем список звонков
          
          // Скрываем контейнер прогресса
          const container = document.getElementById('analysisProgressContainer');
          if (container) {
            container.style.display = 'none';
          }
          
          // Показываем уведомление
          showNotification('success', 'Анализ завершен', 'Звонок успешно проанализирован');
        }, 2000); // Задержка, чтобы пользователь увидел завершение
      }
    },
    
    // Отмена анализа
    async cancelAnalysis() {
      if (!this.currentCallId || !confirm('Вы уверены, что хотите отменить анализ?')) return;
      
      try {
        // Здесь должен быть запрос к API для отмены анализа
        // Например:
        // const response = await fetch(`${API_BASE_URL}/calls/cancel/${this.currentCallId}`, { method: 'POST' });
        
        // Для демонстрации просто останавливаем отслеживание
        this.stopTracking(false);
        
        // Скрываем контейнер прогресса
        const container = document.getElementById('analysisProgressContainer');
        if (container) {
          container.style.display = 'none';
        }
        
        showNotification('info', 'Анализ отменен', 'Анализ звонка был отменен');
      } catch (error) {
        console.error('Ошибка при отмене анализа:', error);
        showNotification('error', 'Ошибка', 'Не удалось отменить анализ');
      }
    }
  };
  
  // Инициализация при загрузке документа
  document.addEventListener('DOMContentLoaded', function() {
    ProgressTracker.init();
  });