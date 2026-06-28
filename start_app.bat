@echo off
cd /d "%~dp0"
echo 🚀 Starting Agentic Analyst (Frontend + Backend + Database)...
echo.

:: Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker is not running. Please start Docker Desktop first.
    pause
    exit /b
)

:: Start the containers in detached mode
docker-compose up -d --build

echo.
echo ⏳ Waiting for services to initialize...
timeout /t 5 /nobreak >nul

:: Open the browser
echo 🌐 Opening the UI...
start http://localhost:5173

echo.
echo ✅ Application is running!
echo 📝 Backend: http://localhost:3001
echo 📝 Frontend: http://localhost:5173
echo.
echo Press any key to stop the application...
pause

:: Stop the containers
echo 🛑 Stopping services...
docker-compose down
echo 👋 Goodbye!
