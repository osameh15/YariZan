using System.Diagnostics;
using System.Security.AccessControl;
using System.Security.Principal;

namespace YariZan.Core;

public sealed class GameLauncher : IDisposable
{
    private readonly List<string> _temps = new();
    private readonly List<Process> _processes = new();

    public Process Launch(byte[] masterKey, string encryptedGameFullPath, string displayName)
    {
        var plain = GameCrypto.Decrypt(masterKey, encryptedGameFullPath);

        var dir = Path.Combine(Path.GetTempPath(), "YariZan", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        var file = Path.Combine(dir, SanitizeName(displayName) + ".exe");
        File.WriteAllBytes(file, plain);
        Array.Clear(plain, 0, plain.Length);

        TryRestrictAcl(file);
        _temps.Add(dir);

        var psi = new ProcessStartInfo(file) { UseShellExecute = false, WorkingDirectory = dir };
        var p = Process.Start(psi)!;
        _processes.Add(p);
        p.EnableRaisingEvents = true;
        p.Exited += (_, _) => CleanupDir(dir);
        return p;
    }

    private static string SanitizeName(string s)
    {
        var bad = Path.GetInvalidFileNameChars();
        var clean = new string(s.Select(c => bad.Contains(c) ? '_' : c).ToArray());
        return string.IsNullOrWhiteSpace(clean) ? "game" : clean;
    }

    private static void TryRestrictAcl(string path)
    {
        try
        {
            var fi = new FileInfo(path);
            var sec = fi.GetAccessControl();
            sec.SetAccessRuleProtection(true, false);
            var me = WindowsIdentity.GetCurrent().User!;
            sec.AddAccessRule(new FileSystemAccessRule(
                me, FileSystemRights.FullControl, AccessControlType.Allow));
            fi.SetAccessControl(sec);
        }
        catch { }
    }

    private static void CleanupDir(string dir)
    {
        for (int i = 0; i < 5; i++)
        {
            try { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); return; }
            catch { Thread.Sleep(200); }
        }
    }

    public void Dispose()
    {
        StopGames();
        foreach (var d in _temps) CleanupDir(d);
    }

    public void StopGames()
    {
        foreach (var process in _processes)
        {
            try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
            catch { }
            process.Dispose();
        }
        _processes.Clear();
    }
}
