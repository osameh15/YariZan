using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using YariZan.Core;

internal static class LauncherChecks
{
    private static int _checks;
    private static void Check(bool success, string name)
    {
        if (!success) throw new Exception(name);
        Console.WriteLine("PASS " + name);
        _checks++;
    }

    private static async Task Canceled(Task<Process> task, string name)
    {
        try { await task; throw new Exception(name); }
        catch (OperationCanceledException) { Check(true, name); }
    }

    private static object Gate(GameLauncher launcher) => typeof(GameLauncher)
        .GetField("_sync", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(launcher)!;

    public static async Task Main(string[] args)
    {
        var root = Path.GetFullPath(args[1]);
        Directory.CreateDirectory(root);
        var key = RandomNumberGenerator.GetBytes(32);
        var encrypted = Path.Combine(root, "game.dat");
        GameCrypto.Encrypt(key, args[0], encrypted);
        using var launcher = new GameLauncher();
        using var canceled = new CancellationTokenSource();
        canceled.Cancel();
        await Canceled(launcher.LaunchAsync(key, encrypted, "test", canceled.Token), "pre-canceled click never starts a game");

        Task<Process> revoked;
        lock (Gate(launcher))
        {
            revoked = launcher.LaunchAsync(key, encrypted, "test");
            launcher.StopGames();
        }
        await Canceled(revoked, "revocation prevents queued or preparing games from starting");

        var closing = new GameLauncher();
        Task<Process> shutdown;
        lock (Gate(closing))
        {
            shutdown = closing.LaunchAsync(key, encrypted, "test");
            closing.Dispose();
        }
        await Canceled(shutdown, "shutdown prevents a late game start");

        var corrupt = Path.Combine(root, "corrupt.dat");
        File.WriteAllText(corrupt, "not an encrypted game");
        try { await launcher.LaunchAsync(key, corrupt, "test"); throw new Exception("corruption accepted"); }
        catch (InvalidDataException) { Check(true, "decryption errors reach the caller"); }

        var pending = launcher.LaunchAsync(key, encrypted, "صفحه سوم کتاب آموزشی");
        var process = await pending;
        var dir = process.StartInfo.WorkingDirectory;
        Check(!process.HasExited && Path.GetFileName(process.StartInfo.FileName) == "صفحه سوم کتاب آموزشی.exe",
            "background preparation launches a game with a Persian filename");
        Check(process.WaitForInputIdle(10_000), "launched GUI reaches its input-ready state");
        int id = process.Id;
        launcher.StopGames();
        launcher.Dispose();
        bool running;
        try { using var live = Process.GetProcessById(id); running = !live.HasExited; }
        catch (ArgumentException) { running = false; }
        Check(!running, "revocation stops the owned game");
        Check(!Directory.Exists(dir), "decrypted game files are cleaned up");
        Array.Clear(key);
        Console.WriteLine($"{_checks} launcher checks passed.");
    }
}
