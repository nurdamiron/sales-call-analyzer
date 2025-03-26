import uvicorn
import os
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

if __name__ == "__main__":
    # Запуск сервера
    uvicorn.run(
        "app.main:app", 
        host=os.getenv("APP_HOST", "0.0.0.0"),
        port=int(os.getenv("APP_PORT", 8000)),
        reload=True
    )