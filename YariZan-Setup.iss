; YariZan Inno Setup Script
; Generates a Windows installer for the YariZan launcher.
; Requires Inno Setup 6.0 or later: https://jrsoftware.org/isinfo.php
; Build with build-installer.bat (which publishes the app first).

#ifndef Grade
#define Grade "1"
#endif
#define MyAppName        "YariZan G" + Grade
#define MyAppNameFa      "یاریزان"
; The version comes from src/YariZan.App/YariZan.App.csproj (build-installer.bat passes /DMyAppVersion).
; This default must stay equal to it: tools/release/windows-version.test.mjs fails otherwise.
#ifndef MyAppVersion
#define MyAppVersion     "2.0.0"
#endif
#define MyAppPublisher   "OAR NOVA GAMES STUDIO"
#define MyAppURL         "https://yarizan.oarnova.games/"
#define MyAppSupportURL  "https://yarizan.oarnova.games/support"
#define MyAppUpdatesURL  "https://yarizan.oarnova.games/download"
#define MyAppSupportEmail "support@oarnova.games"
#define MyAppExeName     "YariZan-G" + Grade + ".exe"
; Physical acceptance candidate (build-installer.bat --acceptance-candidate passes /DCandidate=1):
; its file name and product version say so, and the release checks refuse it.
#ifdef Candidate
#define Suffix "-acceptance-candidate"
#else
#define Suffix ""
#endif
#ifndef MyPublishDir
#define MyPublishDir     "publish\YariZan-G" + Grade + "-win-x64"
#endif

[Setup]
; Stable random GUID — do NOT change between releases or upgrades will misbehave.
AppId=YariZan-Grade-{#Grade}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}{#Suffix}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppSupportURL}
AppUpdatesURL={#MyAppUpdatesURL}
AppCopyright=Copyright (C) 2026 {#MyAppPublisher}
AppContact={#MyAppSupportEmail}

DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
CreateAppDir=yes
DisableDirPage=no
DisableProgramGroupPage=no

OutputDir=publish
OutputBaseFilename=YariZan-G{#Grade}-Setup-v{#MyAppVersion}{#Suffix}
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

VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoCopyright=Copyright (C) 2026 {#MyAppPublisher}
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}.0
VersionInfoTextVersion={#MyAppVersion}{#Suffix}
VersionInfoProductTextVersion={#MyAppVersion}{#Suffix}

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
WelcomeLabel2=This will install [name/ver] on your computer.%n%nYariZan is the Persian educational game collection for grade {#Grade} by OAR NOVA GAMES STUDIO.%n%n  - Activate once on this device; licensed play then works offline%n  - Two trial sessions (internet is needed only to start each trial)%n  - Connect the app to your account on yarizan.oarnova.games%n%nWebsite: yarizan.oarnova.games%nSupport: {#MyAppSupportEmail}%n%nPlease close other applications before continuing.
FinishedLabel=YariZan has been installed.%n%nOpen it from the Start Menu or the Desktop shortcut. To buy, activate or connect your account, use the app's activation screen or visit yarizan.oarnova.games. Support: {#MyAppSupportEmail}.%n%nReinstalling or upgrading keeps this device's activation. It does not reset trial usage.
