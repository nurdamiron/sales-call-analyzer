// Константы для уведомлений
const NOTIFICATION_TYPES = {
    success: {
        icon: 'bi-check-circle-fill',
        title: 'Успешно',
        className: 'notification-success'
    },
    error: {
        icon: 'bi-x-circle-fill',
        title: 'Ошибка',
        className: 'notification-error'
    },
    warning: {
        icon: 'bi-exclamation-triangle-fill',
        title: 'Внимание',
        className: 'notification-warning'
    },
    info: {
        icon: 'bi-info-circle-fill',
        title: 'Информация',
        className: 'notification-info'
    }
};

// Время отображения уведомления в миллисекундах
const NOTIFICATION_TIMEOUT = 5000;

// Текущий ID для уведомлений
let notificationCounter = 0;

// Контейнер для уведомлений
let notificationContainer;

// Инициализация системы уведомлений
function initNotifications() {
    notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) {
        console.error('Не найден контейнер для уведомлений');
        return;
    }
}

// Функция для отображения уведомления
function showNotification(type, title, message) {
    if (!notificationContainer) {
        initNotifications();
        if (!notificationContainer) return;
    }
    
    // Проверяем корректность типа уведомления
    if (!NOTIFICATION_TYPES[type]) {
        type = 'info'; // Дефолтный тип, если указан некорректный
    }
    
    // Создаем идентификатор для уведомления
    const notificationId = `notification-${++notificationCounter}`;
    
    // Создаем HTML для уведомления
    const notificationHTML = `
        <div id="${notificationId}" class="notification ${NOTIFICATION_TYPES[type].className}">
            <div class="notification-icon">
                <i class="bi ${NOTIFICATION_TYPES[type].icon}"></i>
            </div>
            <div class="notification-content">
                <h6 class="notification-title">${title || NOTIFICATION_TYPES[type].title}</h6>
                <p class="notification-message">${message}</p>
            </div>
            <div class="notification-close" onclick="closeNotification('${notificationId}')">
                <i class="bi bi-x"></i>
            </div>
        </div>
    `;
    
    // Добавляем уведомление в контейнер
    notificationContainer.insertAdjacentHTML('beforeend', notificationHTML);
    
    // Получаем DOM-элемент созданного уведомления
    const notification = document.getElementById(notificationId);
    
    // Запускаем анимацию появления
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Устанавливаем таймер для автоматического закрытия
    setTimeout(() => {
        closeNotification(notificationId);
    }, NOTIFICATION_TIMEOUT);
    
    return notificationId;
}

// Функция для закрытия уведомления
function closeNotification(notificationId) {
    const notification = document.getElementById(notificationId);
    if (!notification) return;
    
    // Запускаем анимацию скрытия
    notification.classList.remove('show');
    
    // Удаляем элемент после анимации
    setTimeout(() => {
        notification.remove();
    }, 300);
}