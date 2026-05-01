using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

namespace YariZan.Core;

public sealed record TrialState(string Hwid, int Count, DateTime FirstLaunchUtc);

/// <summary>
/// Tracks how many times the un-activated app has been launched on this PC.
/// Persists in two locations (encrypted file + encrypted registry value), takes MAX(file, registry)
/// on read so deleting one mirror does not reset the count. Both blobs are bound to the current HWID,
/// so copying state from another PC fails the AES-GCM authentication.
/// </summary>
public static class TrialStore
{
    public const int MaxTrialLaunches = 2;

    private const string MagicHeader = "YZT1";
    private const string RegistryPath = @"Software\YariZan\State";
    private const string RegistryValueName = "T";
    private const int NonceSize = 12;
    private const int TagSize = 16;

    public static string PrimaryFilePath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "YariZan", "trial.dat");

    public static TrialState? Load()
    {
        var fromFile = LoadFromFile();
        var fromRegistry = LoadFromRegistry();

        if (fromFile is null && fromRegistry is null) return null;
        if (fromFile is null) return fromRegistry;
        if (fromRegistry is null) return fromFile;
        // Rollback resistance: if the two copies disagree, trust the higher count.
        return fromFile.Count >= fromRegistry.Count ? fromFile : fromRegistry;
    }

    public static int Remaining()
    {
        var s = Load();
        var used = s?.Count ?? 0;
        return Math.Max(0, MaxTrialLaunches - used);
    }

    public static bool IsExhausted() => Remaining() <= 0;

    /// <summary>
    /// Increment the trial counter by one and write to both stores.
    /// Idempotent within a process: callers should gate this behind a per-session flag if they want
    /// "one trial = one launch" semantics regardless of UI navigation.
    /// </summary>
    public static TrialState RecordLaunch()
    {
        var existing = Load();
        var hwid = HwidProvider.GetHwid();
        var next = new TrialState(
            Hwid: hwid,
            Count: (existing?.Count ?? 0) + 1,
            FirstLaunchUtc: existing?.FirstLaunchUtc ?? DateTime.UtcNow);

        SaveToFile(next);
        SaveToRegistry(next);
        return next;
    }

    public static void Reset()
    {
        try { if (File.Exists(PrimaryFilePath)) File.Delete(PrimaryFilePath); } catch { }
        try { Registry.CurrentUser.DeleteSubKeyTree(RegistryPath, throwOnMissingSubKey: false); } catch { }
    }

    private static TrialState? LoadFromFile()
    {
        try
        {
            if (!File.Exists(PrimaryFilePath)) return null;
            return DecryptBlob(File.ReadAllBytes(PrimaryFilePath));
        }
        catch { return null; }
    }

    private static TrialState? LoadFromRegistry()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RegistryPath);
            if (key?.GetValue(RegistryValueName) is byte[] blob)
                return DecryptBlob(blob);
            return null;
        }
        catch { return null; }
    }

    private static void SaveToFile(TrialState state)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(PrimaryFilePath)!);
            File.WriteAllBytes(PrimaryFilePath, EncryptBlob(state));
        }
        catch { /* one mirror missing is acceptable; the other still holds the line */ }
    }

    private static void SaveToRegistry(TrialState state)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RegistryPath);
            key?.SetValue(RegistryValueName, EncryptBlob(state), RegistryValueKind.Binary);
        }
        catch { }
    }

    private static byte[] EncryptBlob(TrialState state)
    {
        var json = JsonSerializer.Serialize(state);
        var plain = Encoding.UTF8.GetBytes(json);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var cipher = new byte[plain.Length];
        var tag = new byte[TagSize];
        var key = DeriveKey(state.Hwid);
        using (var aes = new AesGcm(key, TagSize))
            aes.Encrypt(nonce, plain, cipher, tag);

        var ms = new MemoryStream();
        ms.Write(Encoding.ASCII.GetBytes(MagicHeader));
        ms.Write(nonce);
        ms.Write(tag);
        ms.Write(cipher);
        return ms.ToArray();
    }

    private static TrialState? DecryptBlob(byte[] blob)
    {
        if (blob.Length < 4 + NonceSize + TagSize) return null;
        if (Encoding.ASCII.GetString(blob, 0, 4) != MagicHeader) return null;

        var hwid = HwidProvider.GetHwid();
        var key = DeriveKey(hwid);
        var nonce = blob.AsSpan(4, NonceSize);
        var tag = blob.AsSpan(4 + NonceSize, TagSize);
        var cipher = blob.AsSpan(4 + NonceSize + TagSize);
        var plain = new byte[cipher.Length];
        using (var aes = new AesGcm(key, TagSize))
            aes.Decrypt(nonce, cipher, tag, plain);

        var state = JsonSerializer.Deserialize<TrialState>(plain);
        if (state is null) return null;
        // HWID match guard — copying a foreign trial file would have failed AesGcm anyway, but be explicit.
        return string.Equals(state.Hwid, hwid, StringComparison.OrdinalIgnoreCase) ? state : null;
    }

    private static byte[] DeriveKey(string hwid)
    {
        var salt = Encoding.UTF8.GetBytes("YariZan-Trial-v1");
        return Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(hwid), salt, 100_000, HashAlgorithmName.SHA256, 32);
    }
}
