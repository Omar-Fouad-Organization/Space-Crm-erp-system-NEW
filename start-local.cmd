@echo off
set "CRM_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%CRM_NODE%" (
  "%CRM_NODE%" "%~dp0scripts\start-local.mjs"
) else (
  node "%~dp0scripts\start-local.mjs"
)
pause
