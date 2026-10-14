using System.Security.Cryptography;
using System.Text;

namespace YariZan.Core.V2;

public enum StoreReadStatus { Missing, Present, Corrupt }
public sealed record StoreRead(StoreReadStatus Status, string? Envelope = null);
public interface ILicenseStore
{
    StoreRead ReadLicense(Product product);
    StoreRead ReadDecision(Product product);
    void WriteLicense(Product product, string envelope);
    void WriteDecision(Product product, string envelope);
    IDisposable AcquireWriteLock(Product product);
}

/// <summary>Per-user DPAPI, inherited profile ACL, per-SKU atomic replace. Signatures remain mandatory.</summary>
public sealed class FileLicenseStore : ILicenseStore
{
    private readonly string _root;
    public FileLicenseStore(string? root = null) => _root = Path.GetFullPath(root ?? Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OARNOVA", "YariZan", "V2"));
    private string PathFor(Product product, string kind) => Path.Combine(_root, product.Sku + "." + kind + ".dat");
    public StoreRead ReadLicense(Product product) => Read(PathFor(product, "license"));
    public StoreRead ReadDecision(Product product) => Read(PathFor(product, "decision"));
    public void WriteLicense(Product product, string envelope) => Write(PathFor(product, "license"), envelope);
    public void WriteDecision(Product product, string envelope) => Write(PathFor(product, "decision"), envelope);
    public IDisposable AcquireWriteLock(Product product)
    {
        Directory.CreateDirectory(_root);
        // Cross-process lock, never waits in startup read/game path. Busy sync is retried next launch.
        return new FileStream(PathFor(product, "lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
    }

    internal static StoreRead Read(string path)
    {
        try
        {
            using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete);
            if (file.Length is < 1 or > 65536) return new(StoreReadStatus.Corrupt);
            byte[] protectedBytes = new byte[(int)file.Length];
            file.ReadExactly(protectedBytes);
            var bytes = ProtectedData.Unprotect(protectedBytes, null, DataProtectionScope.CurrentUser);
            if (bytes.Length > StrictJson.MaxBytes) return new(StoreReadStatus.Corrupt);
            return new(StoreReadStatus.Present, new UTF8Encoding(false, true).GetString(bytes));
        }
        catch (FileNotFoundException) { return new(StoreReadStatus.Missing); }
        catch (DirectoryNotFoundException) { return new(StoreReadStatus.Missing); }
        catch (Exception ex) when (ex is IOException or CryptographicException or UnauthorizedAccessException or DecoderFallbackException)
        { return new(StoreReadStatus.Corrupt); }
    }

    internal static void Write(string path, string envelope)
    {
        using var validated = StrictJson.Parse(envelope);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        string temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            var bytes = ProtectedData.Protect(Encoding.UTF8.GetBytes(envelope), null, DataProtectionScope.CurrentUser);
            using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
            { file.Write(bytes); file.Flush(true); }
            if (File.Exists(path)) File.Replace(temporary, path, null);
            else File.Move(temporary, path);
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}
