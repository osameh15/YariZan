using System.Diagnostics;
using System.Security.AccessControl;
using System.Security.Principal;

namespace YariZan.Core;

public sealed class GameLauncher : IDisposable
{
    private readonly List<string> _temps = new();
    private readonly List<Process> _processes = new();
    private readonly object _sync = new();
    private long _generation;
    private bool _disposed;

    public Task<Process> LaunchAsync(byte[] masterKey, string encryptedGameFullPath, string displayName,
        CancellationToken cancellation = default)
    {
        long generation = CaptureGeneration();
        return Task.Run(() => LaunchCore(masterKey, encryptedGameFullPath, displayName, generation, cancellation), cancellation);
    }

    public Process Launch(byte[] masterKey, string encryptedGameFullPath, string displayName) =>
        LaunchCore(masterKey, encryptedGameFullPath, displayName, CaptureGeneration(), CancellationToken.None);

    private long CaptureGeneration()
    {
        lock (_sync)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            return _generation;
        }
    }

    private Process LaunchCore(byte[] masterKey, string encryptedGameFullPath, string displayName, long generation, CancellationToken cancellation)
    {
        var dir = Path.Combine(Path.GetTempPath(), "YariZan", Guid.NewGuid().ToString("N"));
        try
        {
            cancellation.ThrowIfCancellationRequested();
            var plain = GameCrypto.Decrypt(masterKey, encryptedGameFullPath);
            var file = Path.Combine(dir, SanitizeName(displayName) + ".exe");
            try
            {
                cancellation.ThrowIfCancellationRequested();
                Directory.CreateDirectory(dir);
                File.WriteAllBytes(file, plain);
            }
            finally { Array.Clear(plain, 0, plain.Length); }
            TryRestrictAcl(file);
            lock (_sync)
            {
                // Revocation or shutdown during preparation must prevent a late launch.
                if (_disposed || generation != _generation) throw new OperationCanceledException();
                cancellation.ThrowIfCancellationRequested();
                var psi = new ProcessStartInfo(file) { UseShellExecute = false, WorkingDirectory = dir };
                var process = Process.Start(psi)!;
                _temps.Add(dir);
                _processes.Add(process);
                process.Exited += (_, _) => CleanupDir(dir);
                process.EnableRaisingEvents = true;
                return process;
            }
        }
        catch { CleanupDir(dir); throw; }
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
        var root = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "YariZan")) + Path.DirectorySeparatorChar;
        dir = Path.GetFullPath(dir);
        if (!dir.StartsWith(root, StringComparison.OrdinalIgnoreCase)) return;
        for (int i = 0; i < 5; i++)
        {
            try { if (Directory.Exists(dir)) Directory.Delete(dir, recursive: true); return; }
            catch { Thread.Sleep(200); }
        }
    }

    public void Dispose()
    {
        lock (_sync) { _disposed = true; }
        StopGames();
        string[] temps;
        lock (_sync) { temps = _temps.ToArray(); _temps.Clear(); }
        foreach (var d in temps) CleanupDir(d);
    }

    public void StopGames()
    {
        Process[] processes;
        lock (_sync)
        {
            _generation++;
            processes = _processes.ToArray();
            _processes.Clear();
        }
        foreach (var process in processes)
        {
            try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
            catch { }
            process.Dispose();
        }
    }
}
