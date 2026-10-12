; YariZan Inno Setup Script
; Generates a Windows installer for the YariZan launcher.
; Requires Inno Setup 6.0 or later: https://jrsoftware.org/isinfo.php
; Build with build-installer.bat (which publishes the app first).

#define MyAppName        "YariZan"
#define MyAppNameFa      "یاریزان"
#define MyAppVersion     "1.0.0"
#define MyAppPublisher   "YariZan Studio"
#define MyAppDeveloper   "osameh_ir"
#define MyAppURL         "https://osameh.dev"
#define MyAppSupportURL  "mailto:support@osameh.dev"
#define MyAppExeName     "YariZan.exe"
#define MyPublishDir     "publish\YariZan-win-x64"

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
AppContact=support@osameh.dev

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
InfoBeforeFile=publish\installer-about.rtf

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
Name: "{app}"

[Files]
; Self-contained .NET 9 publish + games_encrypted/ ride along (Content / CopyToOutputDirectory).
Source: "{#MyPublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Comment: "یاریزان — مجموعه بازی‌های آموزشی"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; Comment: "یاریزان — مجموعه بازی‌های آموزشی"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

; Preserve per-user activation across reinstall. The server controls access and trials.

[Messages]
WelcomeLabel2=This will install [name/ver] on your computer.%n%nYariZan is a Persian RTL launcher for educational mini-games (grades 1-6).%n%nFeatures:%n  - Hardware-bound activation with online access checks%n  - 2 online trial launches%n  - 12 mini-games per spread, page-flip animation%n  - Persian Shabnam font, fullscreen kiosk mode%n%nWebsite: osameh.dev%nSupport: support@osameh.dev%n%nPlease close other applications before continuing.
FinishedLabel=YariZan has been installed successfully.%n%nLaunch from the Start Menu or the Desktop shortcut. Open the cover to check your saved activation or start an online trial. Send your HWID to support@osameh.dev to receive a serial.%n%nWebsite: osameh.dev%nSupport: support@osameh.dev%n%nInternet is required for activation and access checks. Reinstalling does not reset server trial usage or device blocks.

[CustomMessages]
english.SupportTelegram=Telegram: @osameh_ir
english.SupportWebsite=Website: osameh.dev
english.SupportEmail=Support: support@osameh.dev
