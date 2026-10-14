namespace YariZan.Core.V2;

/// <summary>An online redemption credential, never an offline serial or ownership proof.</summary>
public static class ActivationCode
{
    public const int MaxInputLength = 64;
    private const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input) || input.Length > MaxInputLength)
            throw new ArgumentException("INVALID_ACTIVATION_CODE");
        // Only ASCII separators/case are accepted; Unicode lookalikes are not silently folded.
        string compact = input.Replace("-", "").Replace(" ", "").ToUpperInvariant();
        if (compact.Length != 35 || !compact.StartsWith("YZ2", StringComparison.Ordinal)
            || compact[3..].Any(c => !Alphabet.Contains(c)))
            throw new ArgumentException("INVALID_ACTIVATION_CODE");
        return "YZ2-" + string.Join("-", Enumerable.Range(0, 8).Select(i => compact.Substring(3 + i * 4, 4)));
    }
}

// ToString deliberately excludes the secret. Do not persist or log the request body.
public sealed class ActivationCodeRequest(string code, string deviceId, string sku, string requestId)
{
    public string Code { get; } = code;
    public string DeviceId { get; } = deviceId;
    public string Sku { get; } = sku;
    public string RequestId { get; } = requestId;
    public override string ToString() => "ActivationCodeRequest [redacted]";
}

public interface IActivationCodeClient
{
    Task<string> RedeemAsync(ActivationCodeRequest request, CancellationToken cancellation);
}
