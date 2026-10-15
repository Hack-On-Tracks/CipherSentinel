@echo off
echo.
echo ========================================
echo   CipherSentinel – Local Dev Startup
echo ========================================
echo.

:: Check if data/alerts.json exists; if not, run pipeline first
if not exist data\alerts.json (
    echo [1/2] Running ML pipeline to generate data...
    python run_pipeline.py
    if errorlevel 1 (
        echo [ERROR] Pipeline failed. Check Python deps: pip install -r requirements.txt
        pause
        exit /b 1
    )
    echo.
)

echo [2/2] Starting servers...
echo.
echo  Backend:  http://localhost:8000  (FastAPI)
echo  Frontend: http://localhost:5173  (Vite)
echo.
echo Press Ctrl+C in each window to stop.
echo.

:: Start API in new window
start "CipherSentinel API" cmd /k "cd /d %~dp0 && python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload"

:: Small delay so API starts first
timeout /t 2 /nobreak > nul

:: Start frontend in new window
start "CipherSentinel UI" cmd /k "cd /d %~dp0web && npm run dev"

echo Both servers starting...
echo Open http://localhost:5173 in your browser.
pause
