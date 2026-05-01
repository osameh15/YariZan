using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using YariZan.App.Services;
using YariZan.Core;

namespace YariZan.App.Views;

public partial class GamesBookPage : UserControl
{
    public event EventHandler<GameEntry>? GameLaunchRequested;
    public event EventHandler? BackRequested;

    private const int TilesPerPage = 9;
    private const int TilesPerSpread = TilesPerPage * 2;

    private readonly GameLibrary _library;
    private int _grade;
    private int _spreadIndex;

    public GamesBookPage(GameLibrary library)
    {
        _library = library;
        InitializeComponent();
        BuildGradePicker();
        var grades = library.AvailableGrades();
        _grade = grades.Count > 0 ? grades[0] : 1;
        Render();
    }

    private void BuildGradePicker()
    {
        GradePicker.Children.Clear();
        var available = _library.AvailableGrades().ToHashSet();
        for (int g = 1; g <= 6; g++)
        {
            var btn = new ToggleButton
            {
                Content = ToPersianDigits(g.ToString()),
                Style = (Style)FindResource("GradeButton"),
                IsEnabled = available.Contains(g),
            };
            int captured = g;
            btn.Checked += (_, _) => { _grade = captured; _spreadIndex = 0; UpdateGradeChecks(); Render(); };
            btn.Click += (_, _) => { if (btn.IsChecked != true) btn.IsChecked = true; };
            GradePicker.Children.Add(btn);
        }
        UpdateGradeChecks();
    }

    private void UpdateGradeChecks()
    {
        int i = 0;
        foreach (ToggleButton b in GradePicker.Children)
        {
            int g = i + 1;
            b.IsChecked = (g == _grade);
            i++;
        }
    }

    private void Render()
    {
        LeftPage.Children.Clear();
        RightPage.Children.Clear();

        var games = _library.GamesFor(_grade);
        int total = games.Count;
        int totalSpreads = Math.Max(1, (int)Math.Ceiling(total / (double)TilesPerSpread));
        if (_spreadIndex >= totalSpreads) _spreadIndex = totalSpreads - 1;
        if (_spreadIndex < 0) _spreadIndex = 0;

        int start = _spreadIndex * TilesPerSpread;
        FillPage(LeftPage, games, start + TilesPerPage, TilesPerPage);
        FillPage(RightPage, games, start, TilesPerPage);

        PageIndicator.Text = $"پایهٔ {ToPersianDigits(_grade.ToString())}  —  صفحهٔ {ToPersianDigits((_spreadIndex + 1).ToString())} از {ToPersianDigits(totalSpreads.ToString())}";
    }

    private void FillPage(UniformGrid host, IReadOnlyList<GameEntry> games, int start, int count)
    {
        for (int i = 0; i < count; i++)
        {
            int idx = start + i;
            if (idx < games.Count)
                host.Children.Add(MakeTile(games[idx]));
            else
                host.Children.Add(MakePlaceholder());
        }
    }

    private FrameworkElement MakeTile(GameEntry e)
    {
        var btn = new GameTileButton
        {
            Style = (Style)FindResource("GameTile"),
            GameName = e.Name,
            ImagePath = LoadImage(e.ImageFile),
        };
        btn.Click += (_, _) => GameLaunchRequested?.Invoke(this, e);
        return btn;
    }

    private static FrameworkElement MakePlaceholder()
    {
        var b = new Border
        {
            Margin = new Thickness(6),
            CornerRadius = new CornerRadius(8),
            BorderBrush = new SolidColorBrush(Color.FromArgb(40, 0, 0, 0)),
            BorderThickness = new Thickness(1),
            Background = new SolidColorBrush(Color.FromArgb(20, 0, 0, 0)),
        };
        return b;
    }

    private static ImageSource? LoadImage(string relative)
    {
        if (string.IsNullOrEmpty(relative)) return null;
        var full = AppPaths.ResolveGameFile(relative);
        if (!File.Exists(full)) return null;
        try
        {
            var bmp = new BitmapImage();
            bmp.BeginInit();
            bmp.CacheOption = BitmapCacheOption.OnLoad;
            bmp.UriSource = new Uri(full);
            bmp.EndInit();
            bmp.Freeze();
            return bmp;
        }
        catch { return null; }
    }

    private void PrevPage_Click(object sender, RoutedEventArgs e) { _spreadIndex--; AnimateFlip(-1); }
    private void NextPage_Click(object sender, RoutedEventArgs e) { _spreadIndex++; AnimateFlip(+1); }
    private void Back_Click(object sender, RoutedEventArgs e) => BackRequested?.Invoke(this, EventArgs.Empty);

    private void AnimateFlip(int direction)
    {
        var target = direction > 0 ? RightPage : LeftPage;
        target.RenderTransformOrigin = new Point(direction > 0 ? 0 : 1, 0.5);
        var scale = new ScaleTransform(1, 1);
        target.RenderTransform = scale;

        var anim = new DoubleAnimation(1, 0.05, TimeSpan.FromMilliseconds(180))
        {
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
        };
        anim.Completed += (_, _) =>
        {
            Render();
            var back = new DoubleAnimation(0.05, 1, TimeSpan.FromMilliseconds(220))
            {
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
            };
            scale.BeginAnimation(ScaleTransform.ScaleXProperty, back);
        };
        scale.BeginAnimation(ScaleTransform.ScaleXProperty, anim);
    }

    private static string ToPersianDigits(string s)
    {
        var map = new[] { '۰','۱','۲','۳','۴','۵','۶','۷','۸','۹' };
        var arr = s.ToCharArray();
        for (int i = 0; i < arr.Length; i++)
            if (arr[i] >= '0' && arr[i] <= '9') arr[i] = map[arr[i] - '0'];
        return new string(arr);
    }
}

public class GameTileButton : Button
{
    public static readonly DependencyProperty ImagePathProperty =
        DependencyProperty.Register(nameof(ImagePath), typeof(ImageSource), typeof(GameTileButton));
    public static readonly DependencyProperty GameNameProperty =
        DependencyProperty.Register(nameof(GameName), typeof(string), typeof(GameTileButton));

    public ImageSource? ImagePath
    {
        get => (ImageSource?)GetValue(ImagePathProperty);
        set => SetValue(ImagePathProperty, value);
    }

    public string? GameName
    {
        get => (string?)GetValue(GameNameProperty);
        set => SetValue(GameNameProperty, value);
    }
}
