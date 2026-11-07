@echo off
title Dernier Signal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n est pas installe sur cet ordinateur.
  echo Installe la version LTS depuis https://nodejs.org puis relance ce fichier.
  start https://nodejs.org
  pause
  exit /b
)
start "" http://localhost:8080
node server.js
pause
