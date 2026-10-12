@echo off
REM YariZan - Build & Create Installer
REM Publishes the WPF launcher self-contained for win-x64, generates an ICO
REM from the PNG icon, then runs Inno Setup.

setlocal enableextensions
cd /d "%~dp0"
set "NONINTERACTIVE="
set "SKIP_PACK="
:args
if "%~1"=="" goto :start
if /I "%~1"=="--noninteractive" set "NONINTERACTIVE=1"
if /I "%~1"=="--skip-pack" set "SKIP_PACK=1"
shift
goto :args
:start

echo ========================================
echo YariZan Installer Builder
echo ========================================
echo.

REM ----- Step 0: Inno Setup must be installed --------------------------------
if not defined INNO_PATH for %%I in ("%ProgramFiles%\Inno Setup 7\ISCC.exe" "%ProgramFiles(x86)%\Inno Setup 7\ISCC.exe" "%ProgramFiles%\Inno Setup 6\ISCC.exe" "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" "%LocalAppData%\Programs\Inno Setup 7\ISCC.exe" "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe") do if not defined INNO_PATH if exist "%%~I" set "INNO_PATH=%%~I"
if not exist "%INNO_PATH%" (
    echo [ERROR] Inno Setup 6 or 7 compiler was not found.
    echo         Set INNO_PATH to your installed ISCC.exe if using a custom location.
    echo         Install it from: https://jrsoftware.org/isinfo.php
    if not defined NONINTERACTIVE pause
    exit /b 1
)

REM ----- Step 0.5: secrets must exist ----------------------------------------
if not exist "secrets\master.key" (
    echo [ERROR] secrets\master.key is missing.
    echo         This is the AES key used to encrypt the games. Run once:
    echo             dotnet run --project src\YariZan.SerialGen -- init
    if not defined NONINTERACTIVE pause
    exit /b 1
)
if not exist "secrets\public.pem" (
    echo [ERROR] secrets\public.pem is missing.
    echo         Run: dotnet run --project src\YariZan.SerialGen -- init
    if not defined NONINTERACTIVE pause
    exit /b 1
)

REM ----- Step 1: re-pack mini-games ------------------------------------------
echo [Step 1/5] Packing games into games_encrypted/ ...
if defined SKIP_PACK goto :packed
dotnet run --project src\YariZan.Packer
if errorlevel 1 (
    echo [ERROR] Packer failed.
    if not defined NONINTERACTIVE pause
    exit /b 1
)
:packed
if not exist "games_encrypted\manifest.json" (
    echo [ERROR] Packed manifest is missing. Run without --skip-pack.
    exit /b 1
)
echo [OK] Packed catalog ready.
echo.

REM ----- Step 2: generate icon.ico from icon.png -----------------------------
echo [Step 2/5] Generating multi-size icon.ico ...
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\Convert-PngToIco.ps1" ^
    -PngPath "src\YariZan.App\Resources\icon.png" ^
    -IcoPath "src\YariZan.App\Resources\icon.ico"
if errorlevel 1 (
    echo [ERROR] Icon conversion failed.
    if not defined NONINTERACTIVE pause
    exit /b 1
)
echo [OK] icon.ico ready.
echo.

REM Generate the installer About page from the hardcoded app text, without about.txt.
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\Write-InstallerAbout.ps1"
if errorlevel 1 (
    echo [ERROR] Installer About page generation failed.
    if not defined NONINTERACTIVE pause
    exit /b 1
)

REM ----- Step 3: clean previous build ----------------------------------------
echo [Step 3/5] Cleaning previous build ...
dotnet clean src\YariZan.App\YariZan.App.csproj -c Release -v:m
if errorlevel 1 (
    echo [ERROR] dotnet clean failed.
    if not defined NONINTERACTIVE pause
    exit /b 1
)
echo [OK] Clean complete.
echo.

REM ----- Step 4: publish self-contained --------------------------------------
echo [Step 4/5] Publishing self-contained win-x64 build ...
dotnet publish src\YariZan.App\YariZan.App.csproj ^
    -c Release ^
    -r win-x64 ^
    --self-contained true ^
    -p:PublishSingleFile=true ^
    -p:IncludeNativeLibrariesForSelfExtract=true ^
    -p:PublishReadyToRun=false ^
    -p:DebugType=none -p:DebugSymbols=false ^
    -o "publish\YariZan-win-x64"
if errorlevel 1 (
    echo [ERROR] Publish failed.
    if not defined NONINTERACTIVE pause
    exit /b 1
)
echo [OK] Publish complete.
echo.

REM ----- Step 5: compile installer -------------------------------------------
echo [Step 5/5] Compiling installer ...
if not exist "publish" mkdir publish
"%INNO_PATH%" "YariZan-Setup.iss"
if errorlevel 1 (
    echo [ERROR] Installer compilation failed.
    if not defined NONINTERACTIVE pause
    exit /b 1
)
echo [OK] Installer compiled.
echo.

echo ========================================
echo SUCCESS
echo ========================================
echo.
echo Installer:  publish\YariZan-Setup-v1.0.0.exe
echo.
echo Next steps:
echo   1. Test the installer on a clean Windows VM.
echo   2. Optionally generate a SHA-256 checksum.
echo   3. Upload to a Telegram channel / GitHub release.
echo.

if defined NONINTERACTIVE goto :end
choice /C YN /M "Generate SHA-256 checksum"
if errorlevel 2 goto :end
if errorlevel 1 goto :sha

:sha
echo.
echo Generating SHA-256 ...
powershell -NoProfile -Command "Get-FileHash 'publish\YariZan-Setup-v1.0.0.exe' -Algorithm SHA256 | Select-Object -ExpandProperty Hash" > "publish\YariZan-Setup-v1.0.0.sha256"
echo.
type "publish\YariZan-Setup-v1.0.0.sha256"
echo.

:end
echo.
if not defined NONINTERACTIVE pause
endlocal
exit /b 0
