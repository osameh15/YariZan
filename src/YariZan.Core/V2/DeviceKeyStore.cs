using System.Security.Cryptography;
using System.Text;

namespace YariZan.Core.V2;

public interface IDeviceKeyStore : IDisposable
{
    string Assurance { get; }
    byte[] ExportPublicKey();
    byte[] SignChallenge(string challengeId, string nonce, IDeviceIdentity identity);
}

/// <summary>Persisted per-Windows-user key shared by every grade. No machine ACL changes.</summary>
public sealed class CngDeviceKeyStore : IDeviceKeyStore
{
    private readonly CngKey _key;
    public string Assurance { get; }
    public const string SharedKeyName = "OARNOVA.YariZan.DeviceAuth.V2";
    private static readonly CngProvider Platform = new("Microsoft Platform Crypto Provider");

    public CngDeviceKeyStore(string keyName = SharedKeyName, bool preferTpm = true)
    {
        // Never silently replace an existing TPM key if it becomes inaccessible.
        if (CngKey.Exists(keyName, Platform))
        { _key = CngKey.Open(keyName, Platform); Assurance = "TPM"; return; }
        if (CngKey.Exists(keyName, CngProvider.MicrosoftSoftwareKeyStorageProvider))
        { _key = CngKey.Open(keyName, CngProvider.MicrosoftSoftwareKeyStorageProvider); Assurance = "SOFTWARE"; return; }
        if (preferTpm)
        {
            try { _key = Create(keyName, Platform); Assurance = "TPM"; return; }
            catch (CryptographicException) { }
        }
        _key = Create(keyName, CngProvider.MicrosoftSoftwareKeyStorageProvider);
        Assurance = "SOFTWARE";
    }

    private static CngKey Create(string name, CngProvider provider)
    {
        try
        {
            return CngKey.Create(CngAlgorithm.ECDsaP256, name, new CngKeyCreationParameters
            {
                Provider = provider, ExportPolicy = CngExportPolicies.None,
                KeyUsage = CngKeyUsages.Signing, KeyCreationOptions = CngKeyCreationOptions.None
            });
        }
        catch (CryptographicException) when (CngKey.Exists(name, provider))
        { return CngKey.Open(name, provider); } // concurrent grade startup
    }

    public byte[] ExportPublicKey()
    { using var ec = new ECDsaCng(_key); return ec.ExportSubjectPublicKeyInfo(); }

    public byte[] SignChallenge(string challengeId, string nonce, IDeviceIdentity identity)
    {
        if (!identity.IsAvailable || challengeId.Length is < 1 or > 128 || nonce.Length is < 32 or > 512)
            throw new InvalidDataException("Invalid challenge.");
        // Proposed transcript, explicitly not a live enrollment protocol.
        string json = System.Text.Json.JsonSerializer.Serialize(new
        {
            challenge_id = challengeId, nonce, fingerprint_version = identity.FingerprintVersion,
            fingerprint_digest = identity.FingerprintDigest,
            device_public_key = Base64Url.Encode(ExportPublicKey())
        });
        using var document = StrictJson.Parse(json);
        var message = Encoding.UTF8.GetBytes("YariZan-Device-Challenge-V2\n" + CanonicalJson.Serialize(document.RootElement));
        using var ec = new ECDsaCng(_key);
        return ec.SignData(message, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
    }

    public void Dispose() => _key.Dispose();
}
