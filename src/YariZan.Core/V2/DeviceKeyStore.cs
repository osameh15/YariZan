using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32;
using System.Security.Principal;

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
    public const string ProviderRegistryPath = @"Software\OARNOVA\YariZan\DeviceKeysV2";

    public static string ProviderValueName(string keyName) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(keyName)));

    public CngDeviceKeyStore(string keyName = SharedKeyName, bool preferTpm = true)
    {
        using var user = WindowsIdentity.GetCurrent();
        string lockId = ProviderValueName(user.User?.Value + "|" + keyName);
        using var mutex = new Mutex(false, @"Local\YariZan-DeviceKey-V2-" + lockId);
        bool acquired;
        try { acquired = mutex.WaitOne(TimeSpan.FromSeconds(15)); }
        catch (AbandonedMutexException) { acquired = true; }
        if (!acquired) throw new IOException("Device key is busy.");
        try
        {
            using var state = Registry.CurrentUser.CreateSubKey(ProviderRegistryPath);
            string valueName = ProviderValueName(keyName);
            string? recorded = state.GetValue(valueName) as string;
            if (recorded is not null)
            {
                CngProvider provider = recorded switch
                {
                    "TPM" => Platform,
                    "SOFTWARE" => CngProvider.MicrosoftSoftwareKeyStorageProvider,
                    _ => throw new InvalidDataException("Unknown persisted key provider.")
                };
                // Once enrolled/created, provider loss is a recovery error, never key replacement.
                _key = CngKey.Open(keyName, provider); Assurance = recorded; return;
            }
            if (CngKey.Exists(keyName, CngProvider.MicrosoftSoftwareKeyStorageProvider))
            { _key = CngKey.Open(keyName, CngProvider.MicrosoftSoftwareKeyStorageProvider); Assurance = "SOFTWARE"; }
            else
            {
                CngKey? platformKey = null;
                if (preferTpm)
                {
                    // A TPM-less Windows provider can throw even during Exists, before Create.
                    try { platformKey = CngKey.Exists(keyName, Platform) ? CngKey.Open(keyName, Platform) : Create(keyName, Platform); }
                    catch (CryptographicException) { }
                }
                _key = platformKey ?? Create(keyName, CngProvider.MicrosoftSoftwareKeyStorageProvider);
                Assurance = platformKey is null ? "SOFTWARE" : "TPM";
            }
            try { state.SetValue(valueName, Assurance, RegistryValueKind.String); state.Flush(); }
            catch { _key.Dispose(); throw; }
        }
        finally { mutex.ReleaseMutex(); }
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
