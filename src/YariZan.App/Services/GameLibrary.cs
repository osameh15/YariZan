using System.IO;
using YariZan.Core;

namespace YariZan.App.Services;

public sealed class GameLibrary
{
    public GameManifest Manifest { get; }

    public GameLibrary(GameManifest m) { Manifest = m; }

    public static GameLibrary LoadOrEmpty()
    {
        try
        {
            if (File.Exists(AppPaths.ManifestPath))
                return new GameLibrary(GameManifestIo.Read(AppPaths.ManifestPath));
        }
        catch { }
        return new GameLibrary(new GameManifest());
    }

    public IReadOnlyList<int> AvailableGrades() =>
        Manifest.Grades.Where(g => g.Games.Count > 0).Select(g => g.Grade).OrderBy(x => x).ToList();

    public IReadOnlyList<GameEntry> GamesFor(int grade) =>
        Manifest.Grades.FirstOrDefault(g => g.Grade == grade)?.Games ?? new List<GameEntry>();
}
