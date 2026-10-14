using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using YariZan.Core;
using YariZan.App.Services;

namespace YariZan.App.Views;

public partial class InfoPage : UserControl
{
    public event EventHandler? NextRequested;
    public event EventHandler? BackRequested;

    public InfoPage(int? trialRemaining = null, bool isActivated = false, int grade = 1)
    {
        InitializeComponent();
        AppTitle.Text = AppBranding.PersianTitle(grade);
        IntroductionText.Text = $"یاریزان مجموعه‌ای از بازی‌های آموزشی ویژهٔ پایه {AppBranding.GradeName(grade)} دبستان است. هر صفحه از کتاب شامل ۶ بازی است؛ با ورق زدن یا وارد کردن شمارهٔ صفحه به بازی‌های دیگر دسترسی پیدا می‌کنید.";
        var ver = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.1.0";
        VersionText.Text = "نسخهٔ " + ToPersianDigits(ver);

        if (!isActivated)
        {
            int remaining = trialRemaining ?? 0;
            TrialBanner.Visibility = Visibility.Visible;
            TrialBanner.Text =
                "نسخهٔ آزمایشی — " + ToPersianDigits(remaining.ToString()) +
                " ورود بعدی باقی مانده است؛ این اجرا تا بستن برنامه بدون اینترنت ادامه دارد";
        }
    }

    private void Next_Click(object sender, RoutedEventArgs e) =>
        NextRequested?.Invoke(this, EventArgs.Empty);

    private void Back_Click(object sender, RoutedEventArgs e) =>
        BackRequested?.Invoke(this, EventArgs.Empty);

    private void Exit_Click(object sender, RoutedEventArgs e) =>
        Application.Current.Shutdown();

    private void Minimize_Click(object sender, RoutedEventArgs e) =>
        Window.GetWindow(this).WindowState = WindowState.Minimized;

    private static string ToPersianDigits(string s)
    {
        var map = new[] { '۰','۱','۲','۳','۴','۵','۶','۷','۸','۹' };
        var arr = s.ToCharArray();
        for (int i = 0; i < arr.Length; i++)
            if (arr[i] >= '0' && arr[i] <= '9') arr[i] = map[arr[i] - '0'];
        return new string(arr);
    }
}
