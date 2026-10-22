@echo off
REM YariZan - Build & Create Installer
REM Publishes the WPF launcher self-contained for win-x64, generates an ICO
REM from the PNG icon, then runs Inno Setup.

setlocal enableextensions
cd /d "%~dp0"
set "NONINTERACTIVE="
set "SKIP_PACK="
set "GRADE="
:args
if "%~1"=="" goto :start
if /I "%~1"=="--grade" goto :grade_arg
if /I "%~1"=="--noninteractive" set "NONINTERACTIVE=1"
if /I "%~1"=="--skip-pack" set "SKIP_PACK=1"
shift
goto :args
:grade_arg
if "%~2"=="" (
    echo [ERROR] --grade needs a number from 1 through 6.
    exit /b 1
)
set "GRADE=%~2"
shift
shift
goto :args
:start
REM Validate before selecting/packing games or modifying any existing build.
dotnet run --project src\YariZan.ReleaseCheck -c Release -- --commercial "%CD%"
if errorlevel 1 (
    echo [ERROR] V2 commercial release prerequisites are not satisfied. No installer will be built.
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\Get-GameGrade.ps1" -Grade "%GRADE%" -OutputPath "publish\selected-grade.txt"
if errorlevel 1 (
    echo [ERROR] Could not select a grade from miniApps. Use --grade 1 through 6 if needed.
    exit /b 1
)
set /p GRADE=<"publish\selected-grade.txt"
REM The release version has one source: the app project. Inno Setup receives it explicitly.
powershell -NoProfile -Command "([xml](Get-Content 'src/YariZan.App/YariZan.App.csproj')).Project.PropertyGroup.Version | Where-Object { $_ } | Select-Object -First 1" > "publish\release-version.txt"
set /p VERSION=<"publish\release-version.txt"
if not defined VERSION (
    echo [ERROR] Could not read the release version from YariZan.App.csproj.
    exit /b 1
)
set "INSTALLER=publish\YariZan-G%GRADE%-Setup-v%VERSION%.exe"
set "PUBLISH_DIR=publish\YariZan-G%GRADE%-win-x64"
if exist "%PUBLISH_DIR%" (
    set "PUBLISH_DIR=publish\YariZan-G%GRADE%-win-x64-build-%RANDOM%-%RANDOM%"
)
echo Publishing to %PUBLISH_DIR%

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

REM ----- Step 1: re-pack mini-games ------------------------------------------
echo [Step 1/5] Packing games into games_encrypted/ ...
if defined SKIP_PACK goto :packed
dotnet run --project src\YariZan.Packer -- --grade %GRADE%
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
powershell -NoProfile -Command "$m = Get-Content 'games_encrypted/manifest.json' -Raw | ConvertFrom-Json; if ($m.SelectedGrade -ne [int]$env:GRADE -or @($m.Grades).Count -ne 1 -or $m.Grades[0].Grade -ne [int]$env:GRADE) { exit 1 }"
if errorlevel 1 (
    echo [ERROR] Packed catalog does not match the selected grade. Run without --skip-pack.
    exit /b 1
)
echo.

REM ----- Step 2: generate icon.ico from icon.png -----------------------------
echo [Step 2/5] Generating multi-size icon.ico ...
if exist "src\YariZan.App\Resources\YariZan_Brand_Kit_v1\04_App_Icon\Windows\YariZan.ico" (
    powershell -NoProfile -Command "Copy-Item -LiteralPath 'src/YariZan.App/Resources/YariZan_Brand_Kit_v1/04_App_Icon/Windows/YariZan.ico' -Destination 'src/YariZan.App/Resources/icon.ico' -Force"
    if errorlevel 1 exit /b 1
    goto :icon_ready
)
if exist "src\YariZan.App\Resources\icon.ico" goto :icon_ready
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\Convert-PngToIco.ps1" ^
    -PngPath "src\YariZan.App\Resources\icon.png" ^
    -IcoPath "src\YariZan.App\Resources\icon.ico"
if errorlevel 1 (
    echo [ERROR] Icon conversion failed.
    if not defined NONINTERACTIVE pause
    exit /b 1
)
:icon_ready
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
    -p:CommercialRelease=true ^
    "-p:AssemblyTitle=YariZan G%GRADE%" "-p:Product=YariZan G%GRADE%" ^
    -p:DebugType=none -p:DebugSymbols=false ^
    -o "%PUBLISH_DIR%"
if errorlevel 1 (
    echo [ERROR] Publish failed.
    if not defined NONINTERACTIVE pause
    exit /b 1
)
echo [OK] Publish complete.
powershell -NoProfile -Command "Rename-Item -LiteralPath (Join-Path $env:PUBLISH_DIR 'YariZan.exe') -NewName ('YariZan-G' + $env:GRADE + '.exe')"
if errorlevel 1 exit /b 1
REM The commercial binary must report the release version, target the production API and carry no
REM local acceptance build or endpoint.
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\release\Test-WindowsBinary.ps1" -Path "%PUBLISH_DIR%\YariZan-G%GRADE%.exe" -Version "%VERSION%" -Kind app
if errorlevel 1 (
    echo [ERROR] The published application failed the release binary check.
    exit /b 1
)
echo.

REM ----- Step 5: compile installer -------------------------------------------
echo [Step 5/5] Compiling installer ...
if not exist "publish" mkdir publish
"%INNO_PATH%" /DGrade=%GRADE% "/DMyAppVersion=%VERSION%" "/DMyPublishDir=%PUBLISH_DIR%" "YariZan-Setup.iss"
if errorlevel 1 (
    echo [ERROR] Installer compilation failed.
    if not defined NONINTERACTIVE pause
    exit /b 1
)
echo [OK] Installer compiled.
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\release\Test-WindowsBinary.ps1" -Path "%INSTALLER%" -Version "%VERSION%" -Kind installer
if errorlevel 1 (
    echo [ERROR] The installer failed the release binary check.
    exit /b 1
)
powershell -NoProfile -Command "$f = Get-Item -LiteralPath $env:INSTALLER; '{0}  {1}' -f (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $f.Name | Set-Content -LiteralPath ($f.FullName + '.sha256') -Encoding ascii; 'Size: ' + $f.Length + ' bytes'"
if errorlevel 1 exit /b 1
echo.
echo ========================================
echo SUCCESS
echo ========================================
echo.
echo Installer:  %INSTALLER%
type "%INSTALLER%.sha256"
echo.
echo Next steps (docs/YARIZAN-WINDOWS-RELEASE.md):
echo   1. Authenticode-sign the installer and verify the signature.
echo   2. Run the physical acceptance checklist on the signed installer.
echo   3. Publish with tools\local\Publish-YariZanWindowsRelease.ps1.
echo.

:end
echo.
if not defined NONINTERACTIVE pause
endlocal
exit /b 0
