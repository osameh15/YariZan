using System.Net;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using YariZan.Core;

namespace YariZan.App.Services;

public sealed class OnlineTrialClient
{
    private static readonly HttpClient Client = new(new HttpClientHandler { AllowAutoRedirect = false })
    {
        Timeout = TimeSpan.FromSeconds(15)
    };
    private static readonly Uri Endpoint = new("https://yarizan.osameh.dev/api/trial.php");
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    // Retain this request ID across retries so a lost response never costs a second entry.
    private readonly string _nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private string? _paidSerial;
    private bool _trialGranted;
    public bool PaidAuthorized { get; private set; }

    public async Task AuthorizePaidAsync(string serial)
    {
        var normalized = new string(serial.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        await AuthorizeAsync("paid", normalized);
        _paidSerial = normalized;
        PaidAuthorized = true;
    }

    public async Task ValidateSessionAsync()
    {
        if (_paidSerial is not null) await AuthorizeAsync("paid", _paidSerial);
        else if (_trialGranted) await AuthorizeAsync("trial", _nonce);
        else throw new AccessDeniedException();
    }

    public void Revoke() { PaidAuthorized = false; _paidSerial = null; _trialGranted = false; }

    private async Task AuthorizeAsync(string mode, string credential)
    {
        var hwid = HwidProvider.GetHwid();
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        using var response = await Client.PostAsJsonAsync(Endpoint, new { operation = "authorize", hwid, mode, credential, nonce });
        if (response.StatusCode == HttpStatusCode.Forbidden) throw new AccessDeniedException();
        response.EnsureSuccessStatusCode();
        var grant = JsonSerializer.Deserialize<AccessGrant>(await ReadBoundedAsync(response), JsonOptions);
        if (grant is null || !grant.Verify(AppKeys.LoadEmbeddedPublicKeyPem(), hwid, nonce, mode, credential))
            throw new InvalidDataException("Invalid access signature.");
    }

    public async Task<int> RemainingAsync()
    {
        using var response = await Client.PostAsJsonAsync(Endpoint, new { operation = "status", hwid = HwidProvider.GetHwid(), pc_name = Environment.MachineName });
        if (response.StatusCode == HttpStatusCode.Forbidden) throw new AccessDeniedException();
        response.EnsureSuccessStatusCode();
        var status = JsonSerializer.Deserialize<TrialStatus>(await ReadBoundedAsync(response), JsonOptions);
        if (status is null || status.Remaining is < 0 or > 2)
            throw new InvalidDataException("Invalid trial status.");
        return status.Remaining;
    }

    public async Task<int> ConsumeAsync()
    {
        var hwid = HwidProvider.GetHwid();
        using var response = await Client.PostAsJsonAsync(Endpoint, new { operation = "consume", hwid, nonce = _nonce });
        if (response.StatusCode == HttpStatusCode.Forbidden)
        {
            if ((await ReadBoundedAsync(response)).Contains("access_denied")) throw new AccessDeniedException();
            throw new TrialExhaustedException();
        }
        response.EnsureSuccessStatusCode();
        var grant = JsonSerializer.Deserialize<TrialGrant>(await ReadBoundedAsync(response), JsonOptions);
        if (grant is null || !grant.Verify(AppKeys.LoadEmbeddedPublicKeyPem(), hwid, _nonce))
            throw new InvalidDataException("Invalid trial signature.");
        _trialGranted = true;
        return grant.Remaining;
    }

    private static async Task<string> ReadBoundedAsync(HttpResponseMessage response)
    {
        using var stream = await response.Content.ReadAsStreamAsync();
        using var reader = new StreamReader(stream);
        var buffer = new char[4097];
        int count = await reader.ReadBlockAsync(buffer, 0, buffer.Length);
        if (count > 4096) throw new InvalidDataException("Trial response is too large.");
        return new string(buffer, 0, count);
    }

    private sealed record TrialStatus(int Remaining);
}

public sealed class TrialExhaustedException : Exception;
public sealed class AccessDeniedException : Exception;
