using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace YariZan.Core.V2;

/// <summary>Public release inputs only. Approval fingerprints must come from reviewed repository data.</summary>
public static class CommercialReleasePolicy
{
    public static IReadOnlyDictionary<string, string> ReadPublicRoots(string json)
    {
        using var parsed = StrictJson.Parse(json);
        if (parsed.RootElement.ValueKind != JsonValueKind.Object) throw new InvalidDataException("V2_ROOTS_INVALID");
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var entry in parsed.RootElement.EnumerateObject())
        {
            if (!Regex.IsMatch(entry.Name, "\\A[A-Za-z0-9._-]{1,128}\\z")) throw new InvalidDataException("V2_KID_INVALID");
            string pem = entry.Value.GetString() ?? throw new InvalidDataException("V2_ROOTS_INVALID");
            _ = PublicKeyFingerprint(pem);
            result.Add(entry.Name, pem);
        }
        if (result.Count == 0) throw new InvalidDataException("V2_ROOTS_EMPTY");
        return result;
    }

    public static string PublicKeyFingerprint(string pem)
    {
        // ImportFromPem alone also accepts private keys. Accept exactly one SPKI public block instead.
        if (!PemEncoding.TryFind(pem.AsSpan(), out var fields)
            || !pem.AsSpan()[fields.Label].SequenceEqual("PUBLIC KEY".AsSpan()))
            throw new InvalidDataException("V2_PUBLIC_SPKI_REQUIRED");
        var (offset, length) = fields.Location.GetOffsetAndLength(pem.Length);
        if (!string.IsNullOrWhiteSpace(pem[..offset]) || !string.IsNullOrWhiteSpace(pem[(offset + length)..]))
            throw new InvalidDataException("V2_SINGLE_PUBLIC_KEY_REQUIRED");
        var bytes = Convert.FromBase64String(pem[fields.Base64Data]);
        using var key = ECDsa.Create();
        key.ImportSubjectPublicKeyInfo(bytes, out int read);
        if (read != bytes.Length || key.KeySize != 256 || key.ExportParameters(false).Curve.Oid.Value != "1.2.840.10045.3.1.7")
            throw new InvalidDataException("V2_P256_PUBLIC_KEY_REQUIRED");
        return Convert.ToHexString(SHA256.HashData(key.ExportSubjectPublicKeyInfo()));
    }

    public static void ValidateConfiguration(string rootsJson, string approvedJson, string activationJson)
    {
        var roots = ReadPublicRoots(rootsJson);
        using var approvals = StrictJson.Parse(approvedJson);
        StrictJson.Fields(approvals.RootElement, "format", "keys");
        if (approvals.RootElement.GetProperty("format").GetString() != "YARIZAN-APPROVED-RELEASE-ROOTS-V2")
            throw new InvalidDataException("V2_APPROVAL_FORMAT_INVALID");
        var approvedKeys = approvals.RootElement.GetProperty("keys");
        if (approvedKeys.ValueKind != JsonValueKind.Object) throw new InvalidDataException("V2_APPROVAL_KEYS_INVALID");
        foreach (var root in roots)
        {
            if (Regex.IsMatch(root.Key, "test|fixture|disposable|development|demo", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
                throw new InvalidDataException("V2_TEST_ROOT_FORBIDDEN");
            if (!approvedKeys.TryGetProperty(root.Key, out var approval)
                || approval.GetString() != PublicKeyFingerprint(root.Value))
                throw new InvalidDataException("V2_ROOT_NOT_REVIEWED");
        }
        using var activation = StrictJson.Parse(activationJson);
        StrictJson.Fields(activation.RootElement, "format", "api_base", "enrollment_protocol", "additional_profile_enrollment");
        if (activation.RootElement.GetProperty("format").GetString() != "YARIZAN-ACTIVATION-CONFIG-V2"
            || activation.RootElement.GetProperty("api_base").GetString() != DesktopV2Client.ApiBase.AbsoluteUri
            || activation.RootElement.GetProperty("enrollment_protocol").GetString() != "YariZan-Device-Enrollment-V2"
            || activation.RootElement.GetProperty("additional_profile_enrollment").ValueKind != JsonValueKind.True)
            throw new InvalidDataException("V2_ACTIVATION_CONFIG_INVALID");
    }

    /// <summary>
    /// Physical acceptance candidate: the same reviewed production root and production API as the
    /// commercial release, built so that W1-W14 can run on real machines before release approval.
    /// The candidate is marked "2.0.0-acceptance-candidate" and is never a public release: the
    /// publication script and the release binary check accept only the exact release version.
    /// </summary>
    public static void EnsureAcceptanceCandidate(string rootsJson, string approvedJson, string activationJson)
        => ValidateConfiguration(rootsJson, approvedJson, activationJson);

    /// <summary>
    /// Commercial 2.0.0 release: every embedded root must be a production root whose fingerprint is
    /// approved in release/v2-approved-public-roots.json (the reviewed key ceremony), and activation
    /// must target the production API. No property, configuration or environment switch relaxes this.
    /// </summary>
    public static void EnsureCommercialRelease(string rootsJson, string approvedJson, string activationJson)
        => ValidateConfiguration(rootsJson, approvedJson, activationJson);
}
