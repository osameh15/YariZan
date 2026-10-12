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

    public async Task<int> RemainingAsync()
    {
        using var response = await Client.PostAsJsonAsync(Endpoint, new { operation = "status", hwid = HwidProvider.GetHwid(), pc_name = Environment.MachineName });
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
        if (response.StatusCode == HttpStatusCode.Forbidden) throw new TrialExhaustedException();
        response.EnsureSuccessStatusCode();
        var grant = JsonSerializer.Deserialize<TrialGrant>(await ReadBoundedAsync(response), JsonOptions);
        if (grant is null || !grant.Verify(AppKeys.LoadEmbeddedPublicKeyPem(), hwid, _nonce))
            throw new InvalidDataException("Invalid trial signature.");
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
