using System.Text.RegularExpressions;

namespace YariZan.Core;

/// <summary>A textbook page with one or more independently launchable games.</summary>
public sealed class GamePage
{
    public string Name { get; }
    public IReadOnlyList<GameEntry> Games { get; }
    public GameEntry Preview => Games[0];

    private GamePage(string name, IReadOnlyList<GameEntry> games) => (Name, Games) = (name, games);

    public static IReadOnlyList<GamePage> Group(IEnumerable<GameEntry> games) => games
        .GroupBy(g => (g.Grade, Title: PageTitle(g.Name)))
        .Select(g => new GamePage(g.Key.Title, g.ToList()))
        .OrderBy(p => p.Name, GameNameComparer.Instance).ToList();

    private static string PageTitle(string name)
    {
        if (!PersianPageNumber.TryGetNumber(name, out int page)) return name;
        var book = Regex.Match(name, @" کتاب.*?(?=\s*[-–—]|$)").Value.Trim();
        return $"صفحه {page} {book}";
    }

    public string ChoiceName(GameEntry game)
    {
        var suffix = Regex.Match(game.Name, @" کتاب.*?\s*[-–—]\s*(.+)$");
        if (suffix.Success) return suffix.Groups[1].Value.Trim();
        var index = Games.ToList().IndexOf(game) + 1;
        return "بازی " + PersianPageNumber.FromNumber(index);
    }
}
