namespace YariZan.App.Services;

public static class AppBranding
{
    public const string StudioName = "OAR NOVA GAMES STUDIO";
    private static readonly string[] Grades = { "اول", "دوم", "سوم", "چهارم", "پنجم", "ششم" };
    public static string GradeName(int grade) => Grades[Math.Min(6, Math.Max(1, grade)) - 1];
    public static string PersianTitle(int grade) => $"یاریزان - پایه {GradeName(grade)} دبستان";
}
