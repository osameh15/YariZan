using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using YariZan.App.Services;
using YariZan.App.Views;
using YariZan.Core;

internal static class BookChecks
{
    private static int _checks;
    private static void Check(bool condition, string description)
    {
        if (!condition) throw new Exception(description);
        Console.WriteLine("PASS " + description);
        _checks++;
    }

    private static void Pump(Func<bool> done)
    {
        var watch = Stopwatch.StartNew();
        while (!done() && watch.Elapsed < TimeSpan.FromSeconds(10))
        {
            var frame = new DispatcherFrame();
            Dispatcher.CurrentDispatcher.BeginInvoke(DispatcherPriority.Background,
                new Action(() => frame.Continue = false));
            Dispatcher.PushFrame(frame);
            Thread.Sleep(5);
        }
        if (!done()) throw new TimeoutException("UI did not complete its work.");
    }

    [STAThread]
    public static void Main(string[] args)
    {
        string PageTitle(int n) => $"صفحه {PersianPageNumber.FromNumber(n)} کتاب آموزشی";
        var app = new Application();
        app.Resources.MergedDictionaries.Add(new ResourceDictionary
        {
            Source = new Uri("/YariZan;component/Resources/Theme.xaml", UriKind.Relative)
        });
        foreach (int grade in Enumerable.Range(1, 6))
        {
            var cover = new CoverPage(grade);
            Check(((TextBlock)cover.FindName("AppNameText")).Text == AppBranding.PersianTitle(grade),
                "Persian cover title for grade " + grade);
            Check(((Image)cover.FindName("StudioLogo")).Source is not null, "studio logo loads");
        }
        Directory.CreateDirectory(AppPaths.GamesEncryptedDir);
        File.Copy(args[0], AppPaths.ResolveGameFile("portrait.jpg"), true);
        File.WriteAllText(AppPaths.ResolveGameFile("broken.jpg"), "not an image");
        var manifest = new GameManifest { SelectedGrade = 2 };
        manifest.Grades.Add(new GradeEntry { Grade = 1, Games = new() { new GameEntry { Name = "wrong grade" } } });
        manifest.Grades.Add(new GradeEntry { Grade = 2, Games = Enumerable.Range(1, 71).Select(i => new GameEntry
        {
            Grade = 2, Name = PageTitle(i), ImageFile = i == 2 ? "broken.jpg" : "portrait.jpg"
        }).ToList() });
        var page = new GamesBookPage(new GameLibrary(manifest));
        var window = new Window { Content = page, Width = 1200, Height = 780, ShowInTaskbar = false };
        window.Show();
        T Find<T>(string name) where T : class => (T)page.FindName(name);
        void Invoke(string name, params object[] arguments) => typeof(GamesBookPage)
            .GetMethod(name, BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(page, arguments);
        int Index() => (int)typeof(GamesBookPage).GetField("_spreadIndex", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(page)!;
        bool Turning() => (bool)typeof(GamesBookPage).GetField("_turning", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(page)!;
        var right = Find<UniformGrid>("RightSide");
        var left = Find<UniformGrid>("LeftSide");
        var input = Find<TextBox>("PageNumber");
        Image ImageAt(int i) => (Image)((Border)((Grid)((Button)right.Children[i]).Content).Children[0]).Child;
        Pump(() => ImageAt(0).Source is not null);
        Check(Find<TextBlock>("GradeTitle").Text == "دبستانی ها- دوم ابتدایی", "grade-specific Persian title");
        Check(right.Rows == 2 && right.Columns == 3 && left.Rows == 2 && left.Columns == 3, "portrait grid on both pages");
        Check(((GameEntry)((Button)right.Children[0]).Tag).Name == PageTitle(1), "other grades excluded and numeric Persian order retained");
        var orderedPages = new[] { 115, 30, 3, 100, 4, 101 }.Select(PageTitle)
            .OrderBy(name => name, GameNameComparer.Instance).ToArray();
        Check(orderedPages.SequenceEqual(new[] { 3, 4, 30, 100, 101, 115 }.Select(PageTitle)),
            "Persian word titles sort by textbook page number");
        Check(!Find<Button>("PreviousButton").IsEnabled && Find<Button>("NextButton").IsEnabled, "first-page boundaries");
        var firstImage = ImageAt(0).Source;
        Check(firstImage.IsFrozen && ((BitmapSource)firstImage).PixelHeight <= 360, "bounded frozen thumbnail");
        Pump(() => ImageAt(2).Source is not null);
        Check(ImageAt(1).Source is null, "corrupt thumbnail does not break the book");
        foreach (var digits in new[] { "6", "۶", "٦" })
        {
            input.Text = digits;
            Invoke("JumpToPage");
            Pump(() => !Turning());
            Check(Index() == 5, "jump accepts " + digits);
            Check(!Find<Button>("NextButton").IsEnabled && left.Children[5] is Border, "last page and partial spread");
            Invoke("NavigateTo", 0);
            Pump(() => !Turning());
        }
        foreach (var invalid in new[] { "0", "7", "-1", "abc", "", "999999" })
        {
            input.Text = invalid;
            Invoke("JumpToPage");
            Check(Index() == 0 && input.Text == "۱", "invalid page rejected: " + invalid);
        }
        Pump(() => ImageAt(0).Source is not null);
        Check(ReferenceEquals(firstImage, ImageAt(0).Source), "revisited page reuses decoded thumbnail");
        Invoke("NavigateTo", 1);
        Check(left.RenderTransform is TransformGroup && !Find<Grid>("SpreadHost").IsHitTestVisible,
            "page fold animates and blocks game clicks during a turn");
        Invoke("NavigateTo", 2);
        Check(Index() == 1, "rapid navigation cannot overlap transitions");
        Pump(() => !Turning());
        Invoke("NavigateTo", 0);
        Pump(() => !Turning() && ImageAt(0).Source is not null);
        SavePreview(page, args[1]);
        var brandedCover = new CoverPage(1);
        window.Content = brandedCover;
        SavePreview(brandedCover, Path.Combine(Path.GetDirectoryName(args[1])!, "cover-preview.png"));
        var information = new InfoPage(isActivated: true, grade: 1);
        window.Content = information;
        SavePreview(information, Path.Combine(Path.GetDirectoryName(args[1])!, "info-preview.png"));
        var loading = new GameLoadingOverlay { GameName = PageTitle(3) };
        window.Content = loading;
        Check(((Image)loading.FindName("LoadingLogo")).Source is not null, "loading overlay logo loads");
        Check(((TextBlock)loading.FindName("LoadingGameName")).Text == PageTitle(3), "loading overlay identifies the selected game");
        SavePreview(loading, Path.Combine(Path.GetDirectoryName(args[1])!, "loading-preview.png"));
        window.Close();
        Console.WriteLine($"{_checks} book checks passed. Preview: {args[1]}");
    }

    private static void SavePreview(UserControl page, string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        page.Measure(new Size(1200, 740));
        page.Arrange(new Rect(0, 0, 1200, 740));
        page.UpdateLayout();
        var bitmap = new RenderTargetBitmap(1200, 740, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(page);
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using var file = File.Create(path);
        encoder.Save(file);
    }
}
