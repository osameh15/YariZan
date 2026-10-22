using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace YariZan.Core.V2;

public interface IDeviceCredentialProvider
{
    string? DeviceId { get; }
    Task<string> GetEnrolledCredentialAsync(CancellationToken cancellation);
}

/// <summary>Until reviewed enrollment exists, there is no safe default device bearer credential.</summary>
public sealed class UnprovisionedDeviceCredentials : IDeviceCredentialProvider
{
    public string? DeviceId => null;
    public Task<string> GetEnrolledCredentialAsync(CancellationToken cancellation) => throw new EnrollmentRequiredException();
}
public sealed class V2ApiException(string code, HttpStatusCode? status = null, TimeSpan? retryAfter = null) : Exception(code)
{
    public string Code { get; } = code;
    public HttpStatusCode? Status { get; } = status;
    /// <summary>Server-requested delay (Retry-After), bounded by the client; never extends access.</summary>
    public TimeSpan? RetryAfter { get; } = retryAfter;
}
/// <summary>Authenticated entitlement summary for this device and generation. Not proof of access.</summary>
public sealed record DesktopEntitlement(string Sku, string State);
public sealed record DeviceChallenge(string ChallengeId, string Nonce, string ExpiresAt);
public sealed record DeviceRegistrationRequest(int FingerprintVersion, string FingerprintDigest,
    string DevicePublicKey, string ChallengeId, string ChallengeSignature);
public sealed record RegisteredDevice(
    [property: JsonPropertyName("device_id")] string DeviceId,
    [property: JsonPropertyName("username")] string Username,
    [property: JsonPropertyName("enrollment")] JsonElement Enrollment);
public interface IDeviceRegistrationClient
{
    Task<DeviceChallenge> ChallengeAsync(IDeviceIdentity device, string publicKey, CancellationToken cancellation);
    Task<RegisteredDevice> RegisterAsync(DeviceRegistrationRequest request, CancellationToken cancellation);
}

/// <summary>Versioned desktop API client. No PHP fallback or browser-cookie authentication.</summary>
public sealed class DesktopV2Client : IDesktopV2Client, IDeviceRegistrationClient
{
#if YARIZAN_LOCAL_ACCEPTANCE
    // Local acceptance build only (-p:LocalAcceptanceBuild=true, refused with CommercialRelease):
    // the workstation stack on loopback. Fixed at compile time; no setting can redirect it.
    public static readonly Uri ApiBase = new("http://127.0.0.1:3100/api/v2/");
    public const bool LocalAcceptance = true;
#else
    public static readonly Uri ApiBase = new("https://yarizan.oarnova.games/api/v2/");
    public const bool LocalAcceptance = false;
#endif
    private readonly HttpClient _http;
    private readonly IDeviceCredentialProvider _credentials;
    private readonly TimeSpan _timeout;
    public string? DeviceId => _credentials.DeviceId;
    public DesktopV2Client(HttpClient http, IDeviceCredentialProvider credentials, TimeSpan? timeout = null)
    { _http = http; _credentials = credentials; _timeout = timeout ?? TimeSpan.FromSeconds(15); }

    private async Task<string> RequestAsync(HttpMethod method, string route, object? body, CancellationToken cancellation)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        deadline.CancelAfter(_timeout);
        string credential = await _credentials.GetEnrolledCredentialAsync(deadline.Token);
        if (string.IsNullOrWhiteSpace(credential) || credential.Length > 4096) throw new EnrollmentRequiredException();
        using var request = new HttpRequestMessage(method, new Uri(ApiBase, route));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", credential);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (body is not null)
        {
            string json = JsonSerializer.Serialize(body);
            if (Encoding.UTF8.GetByteCount(json) > StrictJson.MaxBytes) throw new InvalidDataException("Request too large.");
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }
        using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
        if ((int)response.StatusCode is >= 300 and < 400) throw new V2ApiException("REDIRECT_REJECTED", response.StatusCode);
        if (response.Content.Headers.ContentLength > StrictJson.MaxBytes) throw new InvalidDataException("Response too large.");
        await using var stream = await response.Content.ReadAsStreamAsync(deadline.Token);
        using var bytes = new MemoryStream();
        byte[] buffer = new byte[4096];
        int count;
        while ((count = await stream.ReadAsync(buffer, deadline.Token)) > 0)
        {
            if (bytes.Length + count > StrictJson.MaxBytes) throw new InvalidDataException("Response too large.");
            bytes.Write(buffer, 0, count);
        }
        string text = new UTF8Encoding(false, true).GetString(bytes.ToArray());
        using var parsed = StrictJson.Parse(text);
        if (!response.IsSuccessStatusCode)
        {
            var error = parsed.RootElement.GetProperty("error");
            string? code = error.GetProperty("code").GetString();
            if (code == "TRIAL_EXHAUSTED" && response.StatusCode == HttpStatusCode.Forbidden) throw new TrialExhaustedException();
            throw new V2ApiException(code is { Length: > 0 and <= 128 } ? code : "HTTP_ERROR", response.StatusCode, RetryAfter(response));
        }
        return text;
    }

    private static TimeSpan? RetryAfter(HttpResponseMessage response)
    {
        var header = response.Headers.RetryAfter;
        var delay = header?.Delta ?? (header?.Date is { } date ? date - DateTimeOffset.UtcNow : null);
        // Clamp so a hostile or broken header can neither spin the client nor stall it for hours.
        return delay is { } value ? TimeSpan.FromSeconds(Math.Clamp(value.TotalSeconds, 1, 900)) : null;
    }

    public async Task<IReadOnlyList<DesktopEntitlement>> GetEntitlementsAsync(CancellationToken cancellation)
    {
        using var json = StrictJson.Parse(await RequestAsync(HttpMethod.Get, "desktop/entitlements", null, cancellation));
        if (json.RootElement.ValueKind != JsonValueKind.Array || json.RootElement.GetArrayLength() > 64)
            throw new InvalidDataException("Invalid entitlement list.");
        var result = new List<DesktopEntitlement>();
        foreach (var item in json.RootElement.EnumerateArray())
        {
            StrictJson.Fields(item, "sku", "state");
            string? sku = item.GetProperty("sku").GetString(), state = item.GetProperty("state").GetString();
            if (!Enumerable.Range(1, 6).Any(g => new Product(g).Sku == sku) || state is not ("ACTIVE" or "REVOKED" or "RESET"))
                throw new InvalidDataException("Invalid entitlement.");
            result.Add(new(sku!, state));
        }
        return result;
    }

    public async Task<int> GetTrialStatusAsync(Product product, CancellationToken cancellation)
    {
        using var json = StrictJson.Parse(await RequestAsync(HttpMethod.Get, $"desktop/trials/{product.Sku}/status", null, cancellation));
        int remaining = json.RootElement.GetProperty("remaining").GetInt32();
        if (remaining is < 0 or > 2) throw new InvalidDataException("Invalid trial count.");
        return remaining;
    }
    public async Task<TrialStartResponse> StartTrialAsync(TrialStartRequest request, CancellationToken cancellation)
    {
        if (!Enumerable.Range(1, 6).Any(g => new Product(g).Sku == request.Sku)) throw new InvalidDataException("Unknown product.");
        using var json = StrictJson.Parse(await RequestAsync(HttpMethod.Post, $"desktop/trials/{request.Sku}/start", new
        { device_id = request.DeviceId, client_nonce = request.ClientNonce, client_process_session_id = request.ProcessSessionId }, cancellation));
        var p = json.RootElement;
        return new(p.GetProperty("grant").GetRawText(), p.GetProperty("remaining").GetInt32(), p.GetProperty("server_time").GetString()!);
    }
    public Task<string> PickupAsync(Product product, CancellationToken cancellation) =>
        RequestAsync(HttpMethod.Post, "desktop/licenses/pickup", new { sku = product.Sku }, cancellation);
    public Task<string> SynchronizeAsync(PaidLicense license, CancellationToken cancellation) =>
        RequestAsync(HttpMethod.Post, "desktop/licenses/sync", new { license_id = license.LicenseId, sku = license.Sku }, cancellation);

    public Task<string> RedeemAsync(ActivationCodeRequest request, CancellationToken cancellation)
    {
        string code = ActivationCode.Normalize(request.Code);
        if (request.DeviceId != DeviceId || !Guid.TryParseExact(request.DeviceId, "D", out var device)
            || device.ToString("D") != request.DeviceId || !Guid.TryParseExact(request.RequestId, "D", out var id)
            || id.ToString("D") != request.RequestId
            || !Enumerable.Range(1, 6).Any(g => new Product(g).Sku == request.Sku))
            throw new ArgumentException("INVALID_REDEMPTION_REQUEST");
        return RequestAsync(HttpMethod.Post, "desktop/activation-codes/redeem", new
        { activation_code = code, device_id = request.DeviceId, sku = request.Sku, request_id = request.RequestId }, cancellation);
    }

    // Registration is deliberately blocked: anonymous first enrollment is not yet a reviewed protocol.
    public Task<DeviceChallenge> ChallengeAsync(IDeviceIdentity device, string publicKey, CancellationToken cancellation) => throw new EnrollmentRequiredException();
    public Task<RegisteredDevice> RegisterAsync(DeviceRegistrationRequest request, CancellationToken cancellation) => throw new EnrollmentRequiredException();
}
