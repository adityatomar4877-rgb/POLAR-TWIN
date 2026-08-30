@echo off
echo Starting POLAR-TWIN FastAPI Backend Server on http://localhost:8000 ...
cd backend
call .venv\Scripts\activate.bat
uvicorn app.main:app --reload --port 8000
pause
