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
    IDeviceIdentity identity, Func<byte[]> readPersistedPublicKey) : ILocalDeviceEnrollmentProvider
{
    public DeviceEnrollment? ReadVerifiedIdentity()
    {
        var saved = store.Read();
        if (saved.Status == StoreReadStatus.Missing) return null;
        if (saved.Status != StoreReadStatus.Present) throw new InvalidDataException("Corrupt enrollment storage.");
        return verifier.VerifyEnrollment(saved.Envelope!, identity, KeyDigest());
    }

    // Foundation only; initial/additional-profile enrollment transports remain blocked by backend security review.
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
