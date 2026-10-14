using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace YariZan.Core.V2;

public sealed record Product
{
    public int Grade { get; }
    public string Sku => $"YARIZAN-G{Grade}";
    public Product(int grade)
    { if (grade is < 1 or > 6) throw new ArgumentOutOfRangeException(nameof(grade)); Grade = grade; }
}

public sealed record PaidLicense(string LicenseId, string CustomerId, string DeviceId, string Sku, int Grade,
    int FingerprintVersion, string FingerprintDigest, long Revision);
public sealed record LicenseDecision(string LicenseId, string DeviceId, string Sku, long Version, string Status);
public sealed record TrialStartRequest(string DeviceId, string Sku, string ClientNonce, string ProcessSessionId);
public sealed record TrialStartResponse(string Grant, int Remaining, string ServerTime);

public interface ILicenseVerifier
{
    PaidLicense VerifyLicense(string envelope, IDeviceIdentity device, Product product);
    LicenseDecision VerifyDecision(string envelope, PaidLicense license);
    void VerifyTrial(string envelope, TrialStartRequest request, Product product);
}

/// <summary>Trust roots are supplied only by the caller's reviewed build configuration, never by artifacts.</summary>
public sealed class SignedArtifactVerifier(IReadOnlyDictionary<string, string> publicKeys) : ILicenseVerifier
{
    public const string LicenseDomain = "YariZan-License-V2\n";
    public const string TrialDomain = "YariZan-Trial-Start-V2\n";
    public const string DecisionDomain = "YariZan-License-Decision-V2\n";

    private JsonElement Verify(string envelope, string domain, string format, params string[] claims)
    {
        using var document = StrictJson.Parse(envelope);
        var root = document.RootElement;
        StrictJson.Fields(root, "algorithm", "payload", "signature");
        if (Text(root, "algorithm") != "ES256-P1363") throw new InvalidDataException("Unknown signature algorithm.");
        var payload = root.GetProperty("payload");
        StrictJson.Fields(payload, claims.Concat(new[] { "format", "kid", "issued_at" }).ToArray());
        if (Text(payload, "format") != format) throw new InvalidDataException("Unknown artifact format.");
        Timestamp(Text(payload, "issued_at"));
        string kid = Text(payload, "kid");
        if (!publicKeys.TryGetValue(kid, out var pem)) throw new InvalidDataException("Unrecognized signing key.");
        byte[] signature = Base64Url.Decode(Text(root, "signature"));
        if (signature.Length != 64) throw new InvalidDataException("Signature must be P1363 P-256.");
        using var ec = ECDsa.Create();
        ec.ImportFromPem(pem);
        if (ec.KeySize != 256 || ec.ExportParameters(false).Curve.Oid.Value != "1.2.840.10045.3.1.7")
            throw new InvalidDataException("Signing key must use P-256.");
        if (!ec.VerifyData(Encoding.UTF8.GetBytes(domain + CanonicalJson.Serialize(payload)), signature,
                HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation))
            throw new InvalidDataException("Invalid artifact signature.");
        return payload.Clone();
    }

    public PaidLicense VerifyLicense(string envelope, IDeviceIdentity device, Product product)
    {
        var p = Verify(envelope, LicenseDomain, "YARIZAN-LICENSE-V2", "license_id", "customer_id", "device_id",
            "sku", "grade", "device_fingerprint_version", "device_fingerprint_digest", "expires_at", "license_revision");
        if (!device.IsAvailable || Number(p, "grade") != product.Grade || Text(p, "sku") != product.Sku
            || Number(p, "device_fingerprint_version") != device.FingerprintVersion
            || Text(p, "device_fingerprint_digest") != device.FingerprintDigest
            || !HexDigest(Text(p, "device_fingerprint_digest")) || p.GetProperty("expires_at").ValueKind != JsonValueKind.Null)
            throw new InvalidDataException("License binding or perpetual policy mismatch.");
        long revision = Positive(p, "license_revision");
        return new(Id(p, "license_id"), Id(p, "customer_id"), Id(p, "device_id"), product.Sku, product.Grade,
            device.FingerprintVersion, device.FingerprintDigest, revision);
    }

    public LicenseDecision VerifyDecision(string envelope, PaidLicense license)
    {
        var p = Verify(envelope, DecisionDomain, "YARIZAN-LICENSE-DECISION-V2", "license_id", "device_id",
            "sku", "device_fingerprint_version", "device_fingerprint_digest", "decision_version", "status");
        if (Id(p, "license_id") != license.LicenseId || Id(p, "device_id") != license.DeviceId
            || Text(p, "sku") != license.Sku || Number(p, "device_fingerprint_version") != license.FingerprintVersion
            || Text(p, "device_fingerprint_digest") != license.FingerprintDigest)
            throw new InvalidDataException("Decision target mismatch.");
        string status = Text(p, "status");
        if (status is not ("ACTIVE" or "REVOKED")) throw new InvalidDataException("Unknown decision status.");
        return new(license.LicenseId, license.DeviceId, license.Sku, Positive(p, "decision_version"), status);
    }

    public void VerifyTrial(string envelope, TrialStartRequest request, Product product)
    {
        var p = Verify(envelope, TrialDomain, "YARIZAN-TRIAL-START-V2", "device_id", "sku", "grade", "client_nonce", "process_session_id");
        if (Id(p, "device_id") != request.DeviceId || Text(p, "sku") != product.Sku || request.Sku != product.Sku
            || Number(p, "grade") != product.Grade || !HexDigest(request.ClientNonce)
            || Text(p, "client_nonce") != request.ClientNonce || Text(p, "process_session_id") != request.ProcessSessionId)
            throw new InvalidDataException("Trial binding mismatch.");
        if (!Guid.TryParseExact(request.ProcessSessionId, "D", out _)) throw new InvalidDataException("Invalid process ID.");
    }

    public static bool HexDigest(string value) => Regex.IsMatch(value, "\\A[A-F0-9]{64}\\z", RegexOptions.CultureInvariant);
    private static string Text(JsonElement p, string name)
    {
        string? text = p.GetProperty(name).GetString();
        if (text is null || text.Length is < 1 or > 1024) throw new InvalidDataException("Invalid claim.");
        return text;
    }
    private static long Number(JsonElement p, string name) => p.GetProperty(name).GetInt64();
    private static long Positive(JsonElement p, string name)
    { long n = Number(p, name); if (n is < 1 or > 9007199254740991) throw new InvalidDataException("Invalid revision."); return n; }
    private static string Id(JsonElement p, string name)
    {
        string id = Text(p, name);
        if (!Guid.TryParseExact(id, "D", out _) || id != id.ToLowerInvariant()) throw new InvalidDataException("Expected lowercase UUID.");
        return id;
    }
    public static void Timestamp(string value)
    {
        if (!Regex.IsMatch(value, "\\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,7})?Z\\z")
            || !DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            throw new InvalidDataException("Expected UTC RFC3339 timestamp.");
    }
}
