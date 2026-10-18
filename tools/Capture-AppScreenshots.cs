using System.Globalization;
using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using System.Xml.Linq;
using YariZan.App.Services;
using YariZan.App.Views;
using YariZan.Core;

internal static class CaptureAppScreenshots
{
    [STAThread]
    private static void Main(string[] args)
    {
        var repo = Path.GetFullPath(args[0]);
        var output = Path.Combine(repo, "docs", "Images");
        Directory.CreateDirectory(output);
        var app = new YariZan.App.App();
        app.InitializeComponent();
        app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
        var manifest = GameManifestIo.Read(Path.Combine(repo, "games_encrypted", "manifest.json"));
        foreach (var game in manifest.Grades.SelectMany(g => g.Games))
        {
            if (string.IsNullOrEmpty(game.ImageFile)) continue;
            var imagePath = AppPaths.ResolveGameFile(game.ImageFile);
            Directory.CreateDirectory(Path.GetDirectoryName(imagePath)!);
            File.Copy(Path.Combine(repo, "games_encrypted", game.ImageFile), imagePath, true);
        }
        var library = new GameLibrary(manifest);
        int grade = manifest.SelectedGrade;
        var games = library.GamesFor(grade);
        var book = new GamesBookPage(library);
        var background = new RadialGradientBrush(Color.FromRgb(0x3A, 0x20, 0x10), Color.FromRgb(0x16, 0x0A, 0x04))
        { GradientOrigin = new Point(0.5, 0.4), Center = new Point(0.5, 0.4), RadiusX = 0.9, RadiusY = 0.9 };

        void Capture(string filename, params UIElement[] views)
        {
            // Detached views render without Loaded callbacks, backend requests or activation changes.
            var root = new Grid { Background = background, FlowDirection = FlowDirection.RightToLeft };
            foreach (var view in views) root.Children.Add(view);
            root.Measure(new Size(1440, 900));
            root.Arrange(new Rect(0, 0, 1440, 900));
            root.UpdateLayout();
            var watch = System.Diagnostics.Stopwatch.StartNew();
            while (watch.ElapsedMilliseconds < 300)
            {
                var frame = new DispatcherFrame();
                Dispatcher.CurrentDispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() => frame.Continue = false));
                Dispatcher.PushFrame(frame);
                Thread.Sleep(10);
            }
            root.UpdateLayout();
            var bitmap = new RenderTargetBitmap(1440, 900, 96, 96, PixelFormats.Pbgra32);
            bitmap.Render(root);
            var encoder = new PngBitmapEncoder();
            encoder.Frames.Add(BitmapFrame.Create(bitmap));
            using (var stream = File.Create(Path.Combine(output, filename))) encoder.Save(stream);
            root.Children.Clear();
            Console.WriteLine("Captured " + filename);
        }

        Capture("cover-page.png", new CoverPage(grade));
        Capture("info-page.png", new InfoPage(isActivated: true, grade: grade));
        // Let all real first-spread thumbnails finish decoding before taking the book snapshot.
        for (int i = 0; i < 30; i++)
        {
            var frame = new DispatcherFrame();
            Dispatcher.CurrentDispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() => frame.Continue = false));
            Dispatcher.PushFrame(frame);
            Thread.Sleep(50);
        }
        Capture("game-book.png", book);
        typeof(GamesBookPage).GetMethod("ShowInfo", BindingFlags.NonPublic | BindingFlags.Instance)!
            .Invoke(book, new object[] { games[0] });
        Capture("game-detail.png", book);
        typeof(GamesBookPage).GetMethod("HideInfo", BindingFlags.NonPublic | BindingFlags.Instance)!.Invoke(book, null);
        Capture("game-loading.png", book, new GameLoadingOverlay { GameName = games[0].Name });

        UserControl LockSnapshot(int remaining, string? status = null)
        {
            // Render the actual activation markup with illustrative state, no network/code-behind.
            var markup = XDocument.Load(Path.Combine(repo, "src/YariZan.App/Views/LockPage.xaml"));
            foreach (var node in markup.Root!.DescendantsAndSelf())
                foreach (var attribute in node.Attributes().Where(a => a.Name.LocalName is "Class" or "Click").ToArray())
                    attribute.Remove();
            var view = (UserControl)XamlReader.Parse(markup.ToString());
            ((TextBlock)view.FindName("HwidText")).Text = "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX";
            var trial = (Button)view.FindName("TrialButton");
            trial.IsEnabled = remaining > 0;
            trial.Content = remaining > 0 ? (remaining == 2 ? "ورود آزمایشی (۲/۲)" : "ورود آزمایشی (۱/۲)") : "آزمایش به پایان رسیده";
            if (status is not null) ((TextBlock)view.FindName("StatusText")).Text = status;
            return view;
        }
        Capture("lock-page.png", LockSnapshot(2));
        Console.WriteLine("Screenshots use the real catalog; trial/activation states are illustrative and HWID is masked.");
        app.Shutdown();
    }
}
