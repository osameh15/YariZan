; YariZan Inno Setup Script
; Generates a Windows installer for the YariZan launcher.
; Requires Inno Setup 6.0 or later: https://jrsoftware.org/isinfo.php
; Build with build-installer.bat (which publishes the app first).

#define MyAppName        "YariZan"
#define MyAppNameFa      "یاریزان"
#define MyAppVersion     "1.0.0"
#define MyAppPublisher   "YariZan Studio"
#define MyAppDeveloper   "osameh_ir"
#define MyAppURL         "https://t.me/osameh_ir"
#define MyAppSupportURL  "https://t.me/osameh_ir"
#define MyAppExeName     "YariZan.exe"
#define MyPublishDir     "src\YariZan.App\bin\Release\net9.0-windows\win-x64\publish"

[Setup]
; Stable random GUID — do NOT change between releases or upgrades will misbehave.
AppId={{F2B7E1A8-3C4D-4A5E-9F1B-2D7C8E9A0B3F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppSupportURL}
AppUpdatesURL={#MyAppURL}
AppCopyright=Copyright (C) 2025 {#MyAppPublisher} — {#MyAppDeveloper}
AppContact={#MyAppSupportURL}

DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
CreateAppDir=yes
DisableDirPage=no
DisableProgramGroupPage=no

OutputDir=publish
OutputBaseFilename=YariZan-Setup-v{#MyAppVersion}
SetupIconFile=src\YariZan.App\Resources\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName} {#MyAppVersion}

LicenseFile=LICENSE.txt

Compression=lzma2/max
SolidCompression=yes

PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

WizardStyle=modern

ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

VersionInfoVersion=1.0.0.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoCopyright=Copyright (C) 2025 {#MyAppPublisher}
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion=1.0.0.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
; Note: For Persian UI in the installer wizard, drop the unofficial Farsi.isl
; from https://github.com/jrsoftware/issrc/tree/main/Files/Languages/Unofficial
; into your Inno Setup\Languages\ folder, then add:
;   Name: "persian"; MessagesFile: "compiler:Languages\Farsi.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Dirs]
Name: "{app}"; Permissions: users-full

[Files]
; Self-contained .NET 9 publish + games_encrypted/ ride along (Content / CopyToOutputDirectory).
Source: "{#MyPublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Comment: "یاریزان — مجموعه بازی‌های آموزشی"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; Comment: "یاریزان — مجموعه بازی‌های آموزشی"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Wipe the per-user activation + trial state on uninstall so a re-install starts fresh.
Type: filesandordirs; Name: "{localappdata}\YariZan"

[Messages]
WelcomeLabel2=This will install [name/ver] on your computer.%n%nYariZan is a Persian RTL launcher for educational mini-games (grades 1-6).%n%nFeatures:%n  - Hardware-locked activation (HWID + ECDSA-P256 signed serials)%n  - 2-launch free trial%n  - 18 mini-games per spread, page-flip animation%n  - Persian Shabnam font, fullscreen kiosk mode%n%nDeveloper: osameh_ir   ·   Telegram: @osameh_ir%n%nIt is recommended that you close all other applications before continuing.
FinishedLabel=YariZan has been installed successfully.%n%nLaunch from the Start Menu or the Desktop shortcut. The first run will show the activation lock screen with your HWID. Send the HWID to the developer at @osameh_ir to receive your serial.%n%nYou get 2 free trial launches before activation is required.

[CustomMessages]
english.SupportTelegram=Telegram: @osameh_ir
