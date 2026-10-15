using System.Security.Cryptography;

namespace YariZan.Core.V2;

/// <summary>Backend-authorized machine identity and this profile's public key, independent of any license.</summary>
public sealed record DeviceEnrollment(string DeviceId, int FingerprintVersion, string FingerprintDigest,
    string DeviceKeyDigest, string ProfileEnrollmentId);

public interface ILocalDeviceEnrollmentProvider
{
    // Local-only. Implementations must authenticate the persisted record, never derive IDs from a license/HWID.
    DeviceEnrollment? ReadVerifiedIdentity();
}
public sealed class UnprovisionedDeviceEnrollment : ILocalDeviceEnrollmentProvider
{
    public DeviceEnrollment? ReadVerifiedIdentity() => null;
}
public interface IDeviceEnrollmentStore
{
    StoreRead Read();
    void Write(string signedEnvelope);
    IDisposable AcquireWriteLock();
}

public sealed class FileDeviceEnrollmentStore : IDeviceEnrollmentStore
{
    private readonly string _path;
    public FileDeviceEnrollmentStore(string? root = null) => _path = Path.Combine(root ?? Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OARNOVA", "YariZan", "V2"), "device-enrollment.dat");
    public StoreRead Read() => FileLicenseStore.Read(_path);
    public void Write(string signedEnvelope) => FileLicenseStore.Write(_path, signedEnvelope);
    public IDisposable AcquireWriteLock()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        return new FileStream(_path + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
    }
}

/// <summary>Only a reviewed backend enrollment response can provision this record. No network at launch.</summary>
public sealed class VerifiedLocalDeviceEnrollmentProvider(IDeviceEnrollmentStore store, ILicenseVerifier verifier,
    IDeviceIdentity identity, Func<byte[]> readPersistedPublicKey) : IProvisionedEnrollmentStore
{
    public DeviceEnrollment? ReadVerifiedIdentity()
    {
        var saved = store.Read();
        if (saved.Status == StoreReadStatus.Missing) return null;
        if (saved.Status != StoreReadStatus.Present) throw new InvalidDataException("Corrupt enrollment storage.");
        return verifier.VerifyEnrollment(saved.Envelope!, identity, KeyDigest());
    }

    // Called only after the desktop-controlled key-proof pickup or authenticated renewal.
    public void StoreAuthenticatedEnrollment(string envelope)
    {
        var incoming = verifier.VerifyEnrollment(envelope, identity, KeyDigest());
        using var writeLock = store.AcquireWriteLock();
        var existing = ReadVerifiedIdentity();
        if (existing is not null && existing != incoming)
            throw new InvalidDataException("Changing a profile enrollment requires authenticated recovery.");
        store.Write(envelope);
    }

    private string KeyDigest() => Convert.ToHexString(SHA256.HashData(readPersistedPublicKey()));
}

/// <summary>DPAPI-protected public pending UUID; no browser code, bearer or trial grant is persisted.</summary>
public sealed class FilePendingPairingStore : IPendingPairingStore
{
    private readonly string _path;
    public FilePendingPairingStore(string? root=null) => _path=Path.Combine(root??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"OARNOVA","YariZan","V2"),"pending-pairing.dat");
    public string? Read()
    {
        var r=FileLicenseStore.Read(_path);
        if(r.Status==StoreReadStatus.Missing)return null;
        if(r.Status!=StoreReadStatus.Present)throw new InvalidDataException("Invalid pending pairing.");
        using var data=StrictJson.Parse(r.Envelope!);StrictJson.Fields(data.RootElement,"pairing_id");
        string? value=data.RootElement.GetProperty("pairing_id").GetString();
        if(!Guid.TryParseExact(value,"D",out var id)||id.ToString("D")!=value)throw new InvalidDataException("Invalid pending pairing.");
        return value;
    }
    public void Write(string id)
    {
        if(!Guid.TryParseExact(id,"D",out _))throw new InvalidDataException("Invalid pairing.");
        FileLicenseStore.Write(_path,System.Text.Json.JsonSerializer.Serialize(new{pairing_id=id}));
    }
    public void Clear() { if(File.Exists(_path)) File.Delete(_path); }
}
