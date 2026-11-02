#ifndef MyAppVersion
#define MyAppVersion "1.0.0"
#endif
#define AppExe "YariZan-NumberBuilder.exe"
#define AppTitle "عددساز کوچولو"
#ifndef MyPublishDir
#define MyPublishDir "publish\YariZan-NumberBuilder-win-x64"
#endif
#ifndef MyPublishDirX86
#define MyPublishDirX86 "publish\YariZan-NumberBuilder-win-x86"
#endif
#ifndef OutputRoot
#define OutputRoot "publish"
#endif

[Setup]
AppId=YariZan-S-NumberBuilder
AppName={#AppTitle}
AppVersion={#MyAppVersion}
AppPublisher=OAR NOVA GAMES STUDIO
AppPublisherURL=https://oarnova.games/
AppSupportURL=https://yarizan.oarnova.games/support
DefaultDirName={autopf}\YariZan Number Builder
DefaultGroupName={#AppTitle}
OutputDir={#OutputRoot}
OutputBaseFilename=YariZan-NumberBuilder-Setup-v{#MyAppVersion}
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
VersionInfoProductName=YariZan Number Builder

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
