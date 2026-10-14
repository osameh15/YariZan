using System.IO;
using System.Net.Http;
using System.Reflection;
using YariZan.Core.V2;

namespace YariZan.App.Services;

public static class DesktopAccessFactory
{
    private static readonly HttpClient Http = new(new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false })
    { Timeout = Timeout.InfiniteTimeSpan };
    public static DesktopAccessController Create(int grade)
    {
        var identity = new DeviceIdentityV2(new WindowsFingerprintProvider());
        // Only a reviewed embedded public-key map may provision release trust roots.
        var keys = new Dictionary<string, string>();
        var assembly = Assembly.GetExecutingAssembly();
        string? resource = assembly.GetManifestResourceNames().SingleOrDefault(n => n.EndsWith("v2-license-public-keys.json", StringComparison.Ordinal));
        if (resource is not null)
        {
            using var stream = assembly.GetManifestResourceStream(resource)!;
            using var reader = new StreamReader(stream);
            using var json = StrictJson.Parse(reader.ReadToEnd());
            foreach (var entry in json.RootElement.EnumerateObject()) keys.Add(entry.Name, entry.Value.GetString()!);
        }
        return new(identity, new Product(grade), new SignedArtifactVerifier(keys), new FileLicenseStore(),
            new DesktopV2Client(Http, new UnprovisionedDeviceCredentials()));
    }
}
