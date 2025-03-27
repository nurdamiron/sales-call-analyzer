import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates # Добавляем импорт
from fastapi import Request # Добавляем импорт
from dotenv import load_dotenv

# Загрузка переменных окружения
load_dotenv()

# Импорт маршрутов API
from app.api.routes import call_routes

# Инициализация приложения
app = FastAPI(
    title="Sales Call Analyzer",
    description="API для анализа и оценки звонков продажников",
    version="0.1.0"
)

# Настройка CORS для разрешения запросов с фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене заменить на конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение статичных файлов
app.mount("/static", StaticFiles(directory="app/static"), name="static")

templates = Jinja2Templates(directory="app/templates")

# Подключение маршрутов
app.include_router(call_routes.router, prefix="/api", tags=["calls"])

# Создание необходимых директорий при старте
@app.on_event("startup")
async def startup_event():
    os.makedirs(os.getenv("UPLOAD_DIR", "app/static/uploads"), exist_ok=True)
    os.makedirs(os.getenv("RESULTS_DIR", "app/static/results"), exist_ok=True)

# Корневой маршрут
@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Запуск сервера
if __name__ == "__main__":
    uvicorn.run(
        "main:app", 
        host=os.getenv("APP_HOST", "0.0.0.0"),
        port=int(os.getenv("APP_PORT", 8000)),
        reload=True
    )