using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace YariZan.Core;

public sealed record ActivationRecord(string Hwid, string Serial);

public static class ActivationStore
{
    public static string DefaultPath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "YariZan", "activation.dat");

    public static void Save(ActivationRecord rec)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(DefaultPath)!);
        var json = JsonSerializer.Serialize(rec);
        var key = DeriveProtectKey(rec.Hwid);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plain = Encoding.UTF8.GetBytes(json);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];
        using (var aes = new AesGcm(key, 16))
            aes.Encrypt(nonce, plain, cipher, tag);
        using var fs = File.Create(DefaultPath);
        fs.Write(Encoding.ASCII.GetBytes("YZA1"));
        fs.Write(nonce); fs.Write(tag); fs.Write(cipher);
    }

    public static ActivationRecord? Load()
    {
        try
        {
            if (!File.Exists(DefaultPath)) return null;
            var blob = File.ReadAllBytes(DefaultPath);
            if (blob.Length < 4 + 12 + 16) return null;
            var hwid = HwidProvider.GetHwid();
            var key = DeriveProtectKey(hwid);
            var nonce = blob.AsSpan(4, 12);
            var tag = blob.AsSpan(16, 16);
            var cipher = blob.AsSpan(32);
            var plain = new byte[cipher.Length];
            using var aes = new AesGcm(key, 16);
            aes.Decrypt(nonce, cipher, tag, plain);
            return JsonSerializer.Deserialize<ActivationRecord>(plain);
        }
        catch { return null; }
    }

    public static void Clear()
    {
        try { if (File.Exists(DefaultPath)) File.Delete(DefaultPath); }
        catch { }
    }

    private static byte[] DeriveProtectKey(string hwid)
    {
        var salt = Encoding.UTF8.GetBytes("YariZan-Activation-v1");
        return Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(hwid), salt, 100_000, HashAlgorithmName.SHA256, 32);
    }
}
