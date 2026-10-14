using System.Diagnostics;
using System.IO;
using System.Windows;
using YariZan.Core.V2;

namespace YariZan.App.Services;

public interface ILockDesktopActions
{
    void CopyText(string text);
    void OpenProductPage(Uri destination);
}

public sealed class WindowsLockDesktopActions : ILockDesktopActions
{
    public void CopyText(string text) => Clipboard.SetText(text);
    public void OpenProductPage(Uri destination)
    {
        // Validate again at the OS boundary; no arbitrary schemes, hosts, queries or command text.
        StoreDestinations.ValidateDestination(destination);
        Process.Start(new ProcessStartInfo(destination.AbsoluteUri) { UseShellExecute = true });
    }
}

/// <summary>Reviewed build configuration, never supplied by a license, server response or username.</summary>
public sealed class StoreDestinations
{
    private readonly IReadOnlyDictionary<int, Uri> _pages;
    private StoreDestinations(IReadOnlyDictionary<int, Uri> pages) => _pages = pages;
    public static StoreDestinations Unavailable { get; } = new(new Dictionary<int, Uri>());
    public Uri? ForGrade(int grade) => _pages.GetValueOrDefault(grade);
    public static StoreDestinations Read(string json)
    {
        using var doc = StrictJson.Parse(json);
        var root = doc.RootElement;
        StrictJson.Fields(root, "format", "operational", "review_reference", "product_pages");
        if (root.GetProperty("format").GetString() != "YARIZAN-STORE-DESTINATIONS-V1")
            throw new InvalidDataException("Invalid store configuration.");
        bool operational = root.GetProperty("operational").GetBoolean();
        string? review = root.GetProperty("review_reference").GetString();
        var pages = new Dictionary<int, Uri>();
        foreach (var page in root.GetProperty("product_pages").EnumerateObject())
        {
            int grade = Enumerable.Range(1, 6).SingleOrDefault(g => page.Name == new Product(g).Sku);
            if (grade == 0 || !Uri.TryCreate(page.Value.GetString(), UriKind.Absolute, out var destination))
                throw new InvalidDataException("Invalid store product.");
            ValidateDestination(destination);
            if (destination.AbsolutePath != $"/products/yarizan-g{grade}")
                throw new InvalidDataException("Store grade mismatch.");
            pages.Add(grade, destination);
        }
        if (operational && (string.IsNullOrWhiteSpace(review) || review.Length > 256 || pages.Count == 0))
            throw new InvalidDataException("Operational store requires reviewed product destinations.");
        return operational ? new(pages) : Unavailable;
    }
    public static void ValidateDestination(Uri destination)
    {
        if (!destination.IsAbsoluteUri || destination.Scheme != Uri.UriSchemeHttps
            || destination.Host != "yarizan.oarnova.games" || !destination.IsDefaultPort
            || destination.UserInfo.Length != 0 || destination.Query.Length != 0 || destination.Fragment.Length != 0
            || !Enumerable.Range(1, 6).Any(g => destination.AbsolutePath == $"/products/yarizan-g{g}"))
            throw new InvalidDataException("Unapproved store destination.");
    }
    public static StoreDestinations LoadEmbedded()
    {
        try
        {
            var assembly = typeof(StoreDestinations).Assembly;
            var name = assembly.GetManifestResourceNames().Single(n => n.EndsWith("v2-store-destinations.json", StringComparison.Ordinal));
            using var stream = assembly.GetManifestResourceStream(name)!;
            if (stream.Length > StrictJson.MaxBytes) return Unavailable;
            using var reader = new StreamReader(stream);
            return Read(reader.ReadToEnd());
        }
        catch (Exception ex) when (ex is IOException or InvalidOperationException or ArgumentException
            or System.Text.Json.JsonException or KeyNotFoundException)
        { return Unavailable; }
    }
}
