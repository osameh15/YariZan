namespace YariZan.Core;

public static class PersianPageNumber
{
    private static readonly string[] Small = { "", "اول", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم", "دهم", "یازدهم", "دوازدهم", "سیزدهم", "چهاردهم", "پانزدهم", "شانزدهم", "هفدهم", "هجدهم", "نوزدهم" };
    private static readonly string[] Tens = { "", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود" };
    private static readonly string[] RoundTens = { "", "", "بیستم", "سی‌ام", "چهلم", "پنجاهم", "شصتم", "هفتادم", "هشتادم", "نودم" };
    private static readonly string[] Hundreds = { "", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد" };
    private static readonly Dictionary<string, int> PageNumbers = Enumerable.Range(1, 999)
        .ToDictionary(FromNumber, n => n, StringComparer.Ordinal);

    public static bool TryGetNumber(string title, out int page)
    {
        var match = System.Text.RegularExpressions.Regex.Match(title, @"^صفحه (.+?) کتاب(?: .+)?$");
        page = 0;
        if (!match.Success) return false;
        var number = new string(match.Groups[1].Value.Select(c =>
            c >= '۰' && c <= '۹' ? (char)('0' + c - '۰') :
            c >= '٠' && c <= '٩' ? (char)('0' + c - '٠') : c).ToArray());
        return (int.TryParse(number, out page) && page is >= 1 and <= 999)
            || PageNumbers.TryGetValue(number, out page)
            || (number == "هشتاد و یک" && (page = 81) == 81)
            || (number == "صد و نوزده" && (page = 119) == 119);
    }

    public static string FromNumber(int page)
    {
        if (page < 1 || page > 999) throw new ArgumentOutOfRangeException(nameof(page));
        if (page < 20) return Small[page];
        if (page < 100) return page % 10 == 0 ? RoundTens[page / 10]
            : Tens[page / 10] + " و " + (page % 10 == 1 ? "یکم" : Small[page % 10]);
        return Hundreds[page / 100] + (page % 100 == 0 ? "م" : " و " +
            (page % 100 == 1 ? "یکم" : FromNumber(page % 100)));
    }
}
