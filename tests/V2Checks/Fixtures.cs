using System.Security.Cryptography;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using YariZan.Core.V2;

internal sealed class Signals : IDeviceFingerprintProvider
{
    public IReadOnlyDictionary<string, IEnumerable<string>> Values { get; set; } = new Dictionary<string, IEnumerable<string>>
    { ["board"] = new[] { " board-123 " }, ["bios"] = new[] { "bios-456" } };
    public string? Fallback { get; set; }
    public IReadOnlyDictionary<string, IEnumerable<string>> ReadSignals() => Values;
    public string? ReadMachineFallback() => Fallback;
}

internal sealed class TestEnrollmentProvider(DeviceEnrollment enrollment) : ILocalDeviceEnrollmentProvider
{
    public DeviceEnrollment? ReadVerifiedIdentity() => enrollment;
}

internal sealed class SigningFixture : IDisposable
{
    public readonly ECDsa Key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
    public const string DeviceId = "10000000-0000-4000-8000-000000000001";
    public const string LicenseId = "20000000-0000-4000-8000-000000000001";
    public const string CustomerId = "30000000-0000-4000-8000-000000000001";
    public const string Issued = "2026-10-14T00:00:00Z";
    public SignedArtifactVerifier Verifier => new(new Dictionary<string, string> { ["disposable-test"] = Key.ExportSubjectPublicKeyInfoPem() });
    public string Sign(Dictionary<string, object?> payload, string domain)
    {
        payload.TryAdd("kid", "disposable-test"); payload.TryAdd("issued_at", Issued);
        using var document = StrictJson.Parse(JsonSerializer.Serialize(payload));
        byte[] message = Encoding.UTF8.GetBytes(domain + CanonicalJson.Serialize(document.RootElement));
        byte[] signature;
        lock (Key) signature = Key.SignData(message, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        return JsonSerializer.Serialize(new { payload, signature = Base64Url.Encode(signature), algorithm = "ES256-P1363" });
    }
    public Dictionary<string, object?> LicensePayload(IDeviceIdentity identity, int grade = 1) => new()
    {
        ["format"] = "YARIZAN-LICENSE-V2", ["license_id"] = LicenseId, ["customer_id"] = CustomerId,
        ["device_id"] = DeviceId, ["sku"] = $"YARIZAN-G{grade}", ["grade"] = grade,
        ["device_fingerprint_version"] = 2, ["device_fingerprint_digest"] = identity.FingerprintDigest,
        ["expires_at"] = null, ["license_revision"] = 1
    };
    public string License(IDeviceIdentity identity, int grade = 1) => Sign(LicensePayload(identity, grade), SignedArtifactVerifier.LicenseDomain);
    public string Enrollment(IDeviceIdentity identity, string keyDigest, string? profileId = null, string? deviceId = null) => Sign(new()
    {
        ["format"] = "YARIZAN-DEVICE-ENROLLMENT-V2", ["device_id"] = deviceId ?? DeviceId,
        ["device_fingerprint_version"] = 2, ["device_fingerprint_digest"] = identity.FingerprintDigest,
        ["device_key_digest"] = keyDigest, ["profile_enrollment_id"] = profileId ?? CustomerId
    }, SignedArtifactVerifier.EnrollmentDomain);
    public string Decision(IDeviceIdentity identity, long revision, string status = "REVOKED", string? sku = null) => Sign(new()
    {
        ["format"] = "YARIZAN-LICENSE-DECISION-V2", ["license_id"] = LicenseId, ["device_id"] = DeviceId,
        ["sku"] = sku ?? "YARIZAN-G1", ["device_fingerprint_version"] = 2,
        ["device_fingerprint_digest"] = identity.FingerprintDigest, ["decision_version"] = revision, ["status"] = status
    }, SignedArtifactVerifier.DecisionDomain);
    public string Trial(TrialStartRequest request) => Sign(new()
    {
        ["format"] = "YARIZAN-TRIAL-START-V2", ["device_id"] = request.DeviceId,
        ["sku"] = request.Sku, ["grade"] = int.Parse(request.Sku[^1..]),
        ["client_nonce"] = request.ClientNonce, ["process_session_id"] = request.ProcessSessionId
    }, SignedArtifactVerifier.TrialDomain);
    public void Dispose() => Key.Dispose();
}

/// <summary>Test-only locked transaction model. Real quota enforcement belongs to PostgreSQL.</summary>
internal sealed class FakeServer(SigningFixture signing, IDeviceIdentity identity) : IDesktopV2Client
{
    private readonly object _transaction = new();
    private readonly Dictionary<(string Device, string Sku), int> _used = new();
    private readonly Dictionary<(string Device, string Sku, string Nonce), (TrialStartRequest Request, TrialStartResponse Response)> _grants = new();
    public string? DeviceId => SigningFixture.DeviceId;
    public bool Offline;
    public bool LoseNextResponse;
    public bool InvalidTrial;
    public int StatusRequests, StartRequests, SyncRequests, PickupRequests;
    public string? SyncResponse;
    public string? PickupResponse;
    public const string ValidCode = "YZ2-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA";
    public string? RedemptionResponse;
    public string? RedemptionError;
    public bool LoseRedemptionResponse;
    public bool ProductBlocked;
    public int RedemptionRequests, Redemptions;
    public ActivationCodeRequest? LastRedemption;
    public TaskCompletionSource<string>? PendingRedemption;
    private readonly Dictionary<string, (ActivationCodeRequest Request, string Response)> _redemptions = new();
    public TaskCompletionSource<string>? PendingSync;
    public TaskCompletionSource<string>? PendingPickup;
    public TrialStartRequest? LastRequest;
    public int Used(string sku = "YARIZAN-G1") { lock (_transaction) return _used.GetValueOrDefault((DeviceId!, sku)); }
    private void Network(CancellationToken cancellation) { cancellation.ThrowIfCancellationRequested(); if (Offline) throw new HttpRequestException("Test network disconnected"); }
    public Task<int> GetTrialStatusAsync(Product product, CancellationToken cancellation)
    { Network(cancellation); if (ProductBlocked) throw new V2ApiException("PRODUCT_BLOCKED", System.Net.HttpStatusCode.Forbidden); Interlocked.Increment(ref StatusRequests); return Task.FromResult(2 - Used(product.Sku)); }
    public Task<TrialStartResponse> StartTrialAsync(TrialStartRequest request, CancellationToken cancellation)
    {
        Network(cancellation); Interlocked.Increment(ref StartRequests); LastRequest = request;
        if (ProductBlocked) throw new V2ApiException("PRODUCT_BLOCKED", System.Net.HttpStatusCode.Forbidden);
        TrialStartResponse response;
        lock (_transaction)
        {
            var nonceKey = (request.DeviceId, request.Sku, request.ClientNonce);
            if (_grants.TryGetValue(nonceKey, out var previous))
            {
                if (previous.Request != request) throw new V2ApiException("IDEMPOTENCY_MISMATCH");
                response = previous.Response;
            }
            else
            {
                var key = (request.DeviceId, request.Sku);
                int used = _used.GetValueOrDefault(key);
                if (used >= 2) throw new TrialExhaustedException();
                response = new(signing.Trial(request), 1 - used, SigningFixture.Issued);
                _used[key] = used + 1; _grants[nonceKey] = (request, response);
            }
            if (LoseNextResponse) { LoseNextResponse = false; throw new HttpRequestException("Lost after commit"); }
        }
        return Task.FromResult(InvalidTrial ? response with { Grant = response.Grant.Replace(request.ClientNonce, new string('0', 64)) } : response);
    }
    public Task<string> SynchronizeAsync(PaidLicense license, CancellationToken cancellation)
    { Interlocked.Increment(ref SyncRequests); Network(cancellation); return PendingSync?.Task.WaitAsync(cancellation) ?? Task.FromResult(SyncResponse ?? signing.Decision(identity, 1, "ACTIVE")); }
    public Task<string> PickupAsync(Product product, CancellationToken cancellation)
    { Interlocked.Increment(ref PickupRequests); Network(cancellation); return PendingPickup?.Task.WaitAsync(cancellation) ?? Task.FromResult(PickupResponse ?? signing.License(identity, product.Grade)); }

    public Task<string> RedeemAsync(ActivationCodeRequest request, CancellationToken cancellation)
    {
        Network(cancellation); Interlocked.Increment(ref RedemptionRequests); LastRedemption = request;
        if (ProductBlocked) throw new V2ApiException("PRODUCT_BLOCKED", System.Net.HttpStatusCode.Forbidden);
        if (RedemptionError is not null) throw new V2ApiException(RedemptionError, System.Net.HttpStatusCode.BadRequest);
        if (PendingRedemption is not null) return PendingRedemption.Task.WaitAsync(cancellation);
        lock (_transaction)
        {
            if (request.DeviceId != DeviceId || request.Sku != "YARIZAN-G1" || request.Code != ValidCode)
                throw new V2ApiException("ACTIVATION_CODE_INVALID", System.Net.HttpStatusCode.BadRequest);
            string response;
            if (_redemptions.TryGetValue(request.RequestId, out var saved))
            {
                if (saved.Request.Code != request.Code || saved.Request.DeviceId != request.DeviceId || saved.Request.Sku != request.Sku)
                    throw new V2ApiException("IDEMPOTENCY_MISMATCH", System.Net.HttpStatusCode.Conflict);
                response = saved.Response;
            }
            else
            {
                if (Redemptions > 0) throw new V2ApiException("ACTIVATION_CODE_USED", System.Net.HttpStatusCode.BadRequest);
                response = RedemptionResponse ?? signing.License(identity);
                _redemptions.Add(request.RequestId, (request, response)); Redemptions++;
            }
            if (LoseRedemptionResponse) { LoseRedemptionResponse = false; throw new HttpRequestException("Lost redemption after commit"); }
            return Task.FromResult(response);
        }
    }
}
