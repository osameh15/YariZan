using System.IO;

namespace YariZan.App.Services;

public static class AppPaths
{
    public static string GamesEncryptedDir =>
        Path.Combine(AppContext.BaseDirectory, "games_encrypted");

    public static string ManifestPath =>
        Path.Combine(GamesEncryptedDir, "manifest.json");

    public static string ResolveGameFile(string relativeFromManifest) =>
        Path.Combine(GamesEncryptedDir, relativeFromManifest.Replace('/', Path.DirectorySeparatorChar));
}
