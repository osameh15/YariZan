#ifndef MyAppVersion
#define MyAppVersion "1.0.0"
#endif
; FileStem selects the product. Persian titles live here, not on the command line.
#ifndef FileStem
#define FileStem "YariZan-NumberBuilder"
#endif
#if FileStem == "YariZan-BundleBuilder"
#define AppTitle "دسته‌ساز کوچک"
#define EnglishName "YariZan Bundle Builder"
#else
#define AppTitle "عددساز کوچولو"
#define EnglishName "YariZan Number Builder"
#endif
#define AppExe FileStem + ".exe"
#ifndef MyPublishDir
#define MyPublishDir "publish\" + FileStem + "-win-x64"
#endif
#ifndef MyPublishDirX86
#define MyPublishDirX86 "publish\" + FileStem + "-win-x86"
#endif
#ifndef OutputRoot
#define OutputRoot "publish"
#endif

[Setup]
AppId={#StringChange(FileStem, "YariZan-", "YariZan-S-")}
AppName={#AppTitle}
AppVersion={#MyAppVersion}
AppPublisher=OAR NOVA GAMES STUDIO
AppPublisherURL=https://oarnova.games/
AppSupportURL=https://yarizan.oarnova.games/support
DefaultDirName={autopf}\{#EnglishName}
DefaultGroupName={#AppTitle}
OutputDir={#OutputRoot}
OutputBaseFilename={#FileStem}-Setup-v{#MyAppVersion}
SetupIconFile=src\YariZan.App\Resources\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x86compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.14393
VersionInfoVersion={#MyAppVersion}.0
VersionInfoProductVersion={#MyAppVersion}.0
VersionInfoProductName={#EnglishName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#MyPublishDir}\games_encrypted\*"; DestDir: "{app}\games_encrypted"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MyPublishDir}\{#AppExe}"; DestDir: "{app}"; Check: Is64BitInstallMode; Flags: ignoreversion
Source: "{#MyPublishDirX86}\{#AppExe}"; DestDir: "{app}"; Check: not Is64BitInstallMode; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppTitle}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppTitle}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#StringChange(AppTitle, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
