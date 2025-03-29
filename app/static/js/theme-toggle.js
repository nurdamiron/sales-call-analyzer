// app/static/js/theme-toggle.js
// Функционал переключения темной/светлой темы

document.addEventListener('DOMContentLoaded', function() {
    const themeToggleBtn = document.getElementById('themeToggle');
    if (!themeToggleBtn) return;
    
    // Получаем текущую тему из localStorage или используем светлую тему по умолчанию
    const storedTheme = localStorage.getItem('theme') || 'light';
    
    // Функция для включения темной темы
    function enableDarkTheme() {
        document.body.classList.add('dark-theme');
        themeToggleBtn.innerHTML = '<i class="bi bi-sun"></i>';
        themeToggleBtn.setAttribute('title', 'Переключить на светлую тему');
        localStorage.setItem('theme', 'dark');
        
        // Обновляем состояние tooltip если он был инициализирован
        if (bootstrap.Tooltip.getInstance(themeToggleBtn)) {
            bootstrap.Tooltip.getInstance(themeToggleBtn).dispose();
        }
        new bootstrap.Tooltip(themeToggleBtn);
    }
    
    // Функция для включения светлой темы
    function enableLightTheme() {
        document.body.classList.remove('dark-theme');
        themeToggleBtn.innerHTML = '<i class="bi bi-moon"></i>';
        themeToggleBtn.setAttribute('title', 'Переключить на темную тему');
        localStorage.setItem('theme', 'light');
        
        // Обновляем состояние tooltip если он был инициализирован
        if (bootstrap.Tooltip.getInstance(themeToggleBtn)) {
            bootstrap.Tooltip.getInstance(themeToggleBtn).dispose();
        }
        new bootstrap.Tooltip(themeToggleBtn);
    }
    
    // Устанавливаем начальное состояние темы
    if (storedTheme === 'dark') {
        enableDarkTheme();
    } else {
        enableLightTheme();
    }
    
    // Инициализируем tooltip
    new bootstrap.Tooltip(themeToggleBtn);
    
    // Обработчик нажатия на кнопку
    themeToggleBtn.addEventListener('click', function() {
        if (document.body.classList.contains('dark-theme')) {
            enableLightTheme();
        } else {
            enableDarkTheme();
        }
    });
    
    // Добавляем медиа-запрос для автоматического переключения темы в зависимости от системных настроек
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    function handleColorSchemeChange(e) {
        // Только если пользователь еще не установил тему вручную
        if (!localStorage.getItem('theme')) {
            if (e.matches) {
                enableDarkTheme();
            } else {
                enableLightTheme();
            }
        }
    }
    
    // Проверяем начальное состояние
    if (!localStorage.getItem('theme')) {
        handleColorSchemeChange(prefersDarkScheme);
    }
    
    // Подписываемся на изменения
    prefersDarkScheme.addEventListener('change', handleColorSchemeChange);
});