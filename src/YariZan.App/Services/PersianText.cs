namespace YariZan.App.Services;

public static class PersianText
{
    public static string Digits(string text) => new(text.Select(c =>
        c is >= '0' and <= '9' ? (char)('۰' + c - '0') :
        c is >= '٠' and <= '٩' ? (char)('۰' + c - '٠') : c).ToArray());
}
