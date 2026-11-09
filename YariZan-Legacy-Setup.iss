; Acceptance candidate only. Public legacy downloads require the real-OS matrix in
; docs/LEGACY-WINDOWS.md. This installs beside the modern product.
#ifndef FileStem
  #error FileStem is required
#endif
#ifndef MyAppVersion
  #error MyAppVersion is required
#endif
#ifndef MyPublishDir
  #error MyPublishDir is required
#endif
#ifndef MyPublishDirX86
  #error MyPublishDirX86 is required
#endif
#ifndef OutputRoot
  #error OutputRoot is required
#endif

[Setup]
AppId={#FileStem}-Legacy-Candidate
AppName={#FileStem} Legacy Windows (Acceptance Candidate)
AppVersion={#MyAppVersion}
AppPublisher=OAR NOVA GAMES STUDIO
AppPublisherURL=https://oarnova.games/
AppSupportURL=https://yarizan.oarnova.games/support
DefaultDirName={autopf}\OARNOVA\{#FileStem} Legacy Candidate
DefaultGroupName={#FileStem} Legacy Candidate
OutputDir={#OutputRoot}
OutputBaseFilename={#FileStem}-Legacy-Setup-v{#MyAppVersion}-candidate
SetupIconFile=src\YariZan.App\Resources\icon.ico
UninstallDisplayIcon={app}\YariZan.exe
MinVersion=6.1sp1
ArchitecturesAllowed=x86compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
VersionInfoVersion={#MyAppVersion}.0
VersionInfoDescription=Legacy Windows acceptance candidate - not a public release
LicenseFile=LICENSE.txt

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "{#MyPublishDir}\games_encrypted\*"; DestDir: "{app}\games_encrypted"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MyPublishDir}\*"; DestDir: "{app}"; Excludes: "games_encrypted\*"; Check: Is64BitInstallMode; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MyPublishDirX86}\*"; DestDir: "{app}"; Excludes: "games_encrypted\*"; Check: not Is64BitInstallMode; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#FileStem} Legacy Candidate"; Filename: "{app}\YariZan.exe"

[Run]
Filename: "{app}\YariZan.exe"; Description: "Launch legacy acceptance candidate"; Flags: nowait postinstall skipifsilent

[Code]
function InitializeSetup(): Boolean;
var
  Version: TWindowsVersion;
  FrameworkRelease: Cardinal;
begin
  Result := False;
  GetWindowsVersionEx(Version);
  if (Version.Major = 6) and (Version.Minor = 2) then begin
    MsgBox('Original Windows 8.0 is not supported. Windows 8.1 is required.', mbError, MB_OK);
    Exit;
  end;
  if not RegQueryDWordValue(HKLM32, 'SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full', 'Release', FrameworkRelease) then
    FrameworkRelease := 0;
  if FrameworkRelease < 528040 then begin
    MsgBox('Microsoft .NET Framework 4.8 is required. Install it from https://dotnet.microsoft.com/download/dotnet-framework/net48 and run this installer again.', mbError, MB_OK);
    Exit;
  end;
  Result := True;
end;
