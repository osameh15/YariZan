using System.Numerics;
using System.Text.RegularExpressions;

namespace YariZan.Core;

/// <summary>Sorts numbered names naturally: page3, page4, page115.</summary>
public sealed class GameNameComparer : IComparer<string>
{
    public static GameNameComparer Instance { get; } = new();

    public int Compare(string? x, string? y)
    {
        if (x is null || y is null) return StringComparer.OrdinalIgnoreCase.Compare(x, y);
        if (PersianPageNumber.TryGetNumber(x, out int leftPage) && PersianPageNumber.TryGetNumber(y, out int rightPage))
            return leftPage.CompareTo(rightPage);
        var left = Regex.Split(x, "([0-9]+)");
        var right = Regex.Split(y, "([0-9]+)");
        for (int i = 0; i < Math.Min(left.Length, right.Length); i++)
        {
            int result = i % 2 == 1
                ? BigInteger.Parse(left[i]).CompareTo(BigInteger.Parse(right[i]))
                : StringComparer.OrdinalIgnoreCase.Compare(left[i], right[i]);
            if (result != 0) return result;
        }
        int length = left.Length.CompareTo(right.Length);
        return length != 0 ? length : StringComparer.OrdinalIgnoreCase.Compare(x, y);
    }
}
