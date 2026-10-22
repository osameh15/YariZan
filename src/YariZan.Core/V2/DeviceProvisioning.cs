using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace YariZan.Core.V2;

public interface IDeviceProofKey : IDisposable
{
    byte[] ExportPublicKey();
    byte[] SignChallenge(string challengeId, string nonce, IDeviceIdentity identity);
}
public interface IProvisionedEnrollmentStore : ILocalDeviceEnrollmentProvider
{
    void StoreAuthenticatedEnrollment(string envelope);
}
public interface IPendingPairingStore
{
    string? Read();
    void Write(string id);
    void Clear();
}
public sealed record DesktopPairing(string Id, string BrowserCode, string Username, DateTimeOffset ExpiresAt);
public interface IDesktopProvisioning
{
    Task<bool> ResumeAsync(CancellationToken cancellation);
    Task<DesktopPairing> BeginAsync(CancellationToken cancellation);
    Task<bool> CompleteAsync(CancellationToken cancellation);
}

/// <summary>Only key-proof endpoints deliver enrollment/bearers. Browser approval is a separate operation.</summary>
public sealed class DesktopProvisioningClient(HttpClient http, IDeviceIdentity identity,
    Func<IDeviceProofKey> keyFactory, IProvisionedEnrollmentStore enrollmentStore,
    IPendingPairingStore pending) : IDeviceCredentialProvider, IDesktopProvisioning
{
    private readonly SemaphoreSlim _operation = new(1, 1);
    private string? _credential;
    private string? _scope;
    private string? _pairingId;
    private DateTimeOffset _credentialExpires;
    public string? DeviceId => enrollmentStore.ReadVerifiedIdentity()?.DeviceId;
#if YARIZAN_LOCAL_ACCEPTANCE
    public static readonly Uri ConnectPage = new("http://localhost:3200/connect");
#else
    public static readonly Uri ConnectPage = new("https://yarizan.oarnova.games/connect");
#endif

    public async Task<DesktopPairing> BeginAsync(CancellationToken cancellation)
    {
        await _operation.WaitAsync(cancellation);
        try
        {
            using var key = keyFactory();
            var proof = await ProofAsync(key, "PAIR", null, cancellation);
            using var response = await RequestAsync("device-pairings", proof, cancellation);
            var p = response.RootElement;
            StrictJson.Fields(p, "pairing_id", "pairing_secret", "username", "expires_at");
            string id = Uuid(p.GetProperty("pairing_id").GetString()), code = Secret(p.GetProperty("pairing_secret").GetString());
            if (p.GetProperty("username").GetString() != identity.Username) throw new InvalidDataException("Pairing identity mismatch.");
            var expires = DateTimeOffset.Parse(p.GetProperty("expires_at").GetString()!, System.Globalization.CultureInfo.InvariantCulture);
            _pairingId=id;
            pending.Write(id); // Only the public pairing UUID is persisted, never browser code or bearer.
            return new(id, code, identity.Username, expires);
        }
        finally { _operation.Release(); }
    }
    public async Task<bool> CompleteAsync(CancellationToken cancellation)
    {
        await _operation.WaitAsync(cancellation);
        try { return await CompleteCoreAsync(cancellation); }
        finally { _operation.Release(); }
    }
    private async Task<bool> CompleteCoreAsync(CancellationToken cancellation)
    {
        string? id = _pairingId ?? pending.Read();
        if (id is null) return false;
        using var key = keyFactory();
        using var result = await RequestAsync($"device-pairings/{Uuid(id)}/pickup", await ProofAsync(key, "CONFIRM", id, cancellation), cancellation);
        var p = result.RootElement;
        if (p.GetProperty("status").GetString() == "PENDING") { StrictJson.Fields(p, "status"); return false; }
        StrictJson.Fields(p, "status", "device_id", "customer_id", "username", "enrollment", "credential");
        if (p.GetProperty("status").GetString() != "ENROLLED" || p.GetProperty("username").GetString() != identity.Username)
            throw new InvalidDataException("Invalid enrollment response.");
        cancellation.ThrowIfCancellationRequested();
        Accept(p, true);
        if(pending.Read()==id)pending.Clear();
        _pairingId=null;
        return true;
    }
    public async Task<string> GetEnrolledCredentialAsync(CancellationToken cancellation)
    {
        await _operation.WaitAsync(cancellation);
        try
        {
            if (_credential is not null && DateTimeOffset.UtcNow < _credentialExpires) return _credential;
            if (enrollmentStore.ReadVerifiedIdentity() is null && pending.Read() is not null)
                try { await CompleteCoreAsync(cancellation); }
                catch(V2ApiException e) when(e.Code=="PAIRING_INVALID") { pending.Clear(); _pairingId=null; }

            if (_credential is not null && DateTimeOffset.UtcNow < _credentialExpires) return _credential;
            using var key = keyFactory();
            using var result = await RequestAsync("devices/authenticate", await ProofAsync(key, "AUTH", null, cancellation), cancellation);
            var p = result.RootElement;
            if (p.TryGetProperty("enrollment", out _)) StrictJson.Fields(p, "device_id", "credential", "scope", "enrollment");
            else StrictJson.Fields(p, "device_id", "credential", "scope");
            string? scope = p.GetProperty("scope").GetString();
            if (scope is not ("desktop" or "tombstone_only") || (scope == "desktop" && !p.TryGetProperty("enrollment", out _)))
                throw new InvalidDataException("Invalid device scope.");
            Accept(p, scope == "desktop");
            return _credential!;
        }
        finally { _operation.Release(); }
    }
    public async Task<bool> ResumeAsync(CancellationToken cancellation)
    {
        await _operation.WaitAsync(cancellation);
        try { _credential=null; _scope=null; } finally { _operation.Release(); }
        try { await GetEnrolledCredentialAsync(cancellation); return _scope=="desktop" && enrollmentStore.ReadVerifiedIdentity() is not null; }
        catch(V2ApiException e) when(e.Code=="ENROLLMENT_REQUIRED") { return false; }
    }
    private void Accept(JsonElement p, bool saveEnrollment)
    {
        string credential = Secret(p.GetProperty("credential").GetString());
        string id = Uuid(p.GetProperty("device_id").GetString());
        // The store verifies pinned root, fingerprint and this profile's CNG public-key digest before writing.
        if (saveEnrollment)
        {
            var envelope=p.GetProperty("enrollment");
            if(envelope.GetProperty("payload").GetProperty("device_id").GetString()!=id)throw new InvalidDataException("Enrollment target mismatch.");
            enrollmentStore.StoreAuthenticatedEnrollment(envelope.GetRawText());
        }
        if (enrollmentStore.ReadVerifiedIdentity()?.DeviceId != id) throw new InvalidDataException("Device identity mismatch.");
        _scope=saveEnrollment?"desktop":"tombstone_only";
        _credential = credential; _credentialExpires = DateTimeOffset.UtcNow.AddMinutes(14);
    }
    private async Task<object> ProofAsync(IDeviceProofKey key, string purpose, string? pairingId, CancellationToken cancellation)
    {
        if (!identity.IsAvailable) throw new EnrollmentRequiredException();
        string publicKey = Base64Url.Encode(key.ExportPublicKey());
        var challengeInput = new Dictionary<string, object> { ["fingerprint_version"] = identity.FingerprintVersion,
            ["fingerprint_digest"] = identity.FingerprintDigest, ["device_public_key"] = publicKey, ["purpose"] = purpose };
        if (pairingId is not null) challengeInput["pairing_id"] = Uuid(pairingId);
        using var challenge = await RequestAsync("devices/challenges", challengeInput, cancellation);
        var p = challenge.RootElement; StrictJson.Fields(p, "challenge_id", "nonce", "expires_at");
        string id = Uuid(p.GetProperty("challenge_id").GetString()), nonce = Secret(p.GetProperty("nonce").GetString());
        return new { fingerprint_version = identity.FingerprintVersion, fingerprint_digest = identity.FingerprintDigest,
            device_public_key = publicKey, challenge_id = id, challenge_signature = Base64Url.Encode(key.SignChallenge(id, nonce, identity)) };
    }
    private static string Secret(string? value) => value is not null && Regex.IsMatch(value, "\\A[A-Za-z0-9_-]{43}\\z") ? value : throw new InvalidDataException("Invalid credential encoding.");
    private static string Uuid(string? value) => Guid.TryParseExact(value, "D", out var id) && id.ToString("D") == value ? value : throw new InvalidDataException("Invalid identifier.");
    private static async Task<JsonDocument> RequestAsyncCore(HttpClient client, string route, object body, CancellationToken cancellation)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation); deadline.CancelAfter(TimeSpan.FromSeconds(15));
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(DesktopV2Client.ApiBase, route));
        string serialized = JsonSerializer.Serialize(body);
        if (Encoding.UTF8.GetByteCount(serialized) > StrictJson.MaxBytes) throw new InvalidDataException("Request too large.");
        request.Content = new StringContent(serialized, Encoding.UTF8, "application/json");
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
        if ((int)response.StatusCode is >= 300 and < 400) throw new V2ApiException("REDIRECT_REJECTED", response.StatusCode);
        if (response.Content.Headers.ContentLength > StrictJson.MaxBytes) throw new InvalidDataException("Response too large.");
        await using var stream = await response.Content.ReadAsStreamAsync(deadline.Token); using var bytes = new MemoryStream();
        var buffer = new byte[4096]; int count;
        while ((count = await stream.ReadAsync(buffer, deadline.Token)) > 0) { if (bytes.Length + count > StrictJson.MaxBytes) throw new InvalidDataException("Response too large."); bytes.Write(buffer, 0, count); }
        var document = StrictJson.Parse(new UTF8Encoding(false, true).GetString(bytes.ToArray()));
        if (!response.IsSuccessStatusCode) { string? code = document.RootElement.GetProperty("error").GetProperty("code").GetString(); document.Dispose(); throw new V2ApiException(code is { Length: > 0 and <= 128 } ? code : "HTTP_ERROR", response.StatusCode); }
        return document;
    }
    private Task<JsonDocument> RequestAsync(string route, object body, CancellationToken cancellation) => RequestAsyncCore(http, route, body, cancellation);
}
