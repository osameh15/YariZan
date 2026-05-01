using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
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

    private const int TilesPerPage = 6;
    private const int TilesPerSpread = TilesPerPage * 2;
    private const int AllGradesValue = 0;

    private readonly GameLibrary _library;
    private int _grade = AllGradesValue;
    private int _spreadIndex;
    private GameEntry? _infoGame;

    public GamesBookPage(GameLibrary library)
    {
        _library = library;
        InitializeComponent();
        BuildGradePicker();
        Render();
    }

    private void BuildGradePicker()
    {
        GradePicker.Children.Clear();
        var available = _library.AvailableGrades().ToHashSet();

        var allChip = MakeChip("همه", AllGradesValue, enabled: true);
        GradePicker.Children.Add(allChip);

        for (int g = 1; g <= 6; g++)
            GradePicker.Children.Add(MakeChip(ToPersianDigits(g.ToString()), g, available.Contains(g)));

        UpdateChecks();
    }

    private ToggleButton MakeChip(string label, int value, bool enabled)
    {
        var b = new ToggleButton
        {
            Content = label,
            Style = (Style)FindResource("GradeChip"),
            IsEnabled = enabled,
            Tag = value,
        };
        b.Checked += (_, _) =>
        {
            if (_grade == value) return;
            _grade = value;
            _spreadIndex = 0;
            UpdateChecks();
            Render();
        };
        b.Click += (_, _) => { if (b.IsChecked != true) b.IsChecked = true; };
        return b;
    }

    private void UpdateChecks()
    {
        foreach (ToggleButton b in GradePicker.Children)
            b.IsChecked = ((int)b.Tag!) == _grade;
    }

    private List<GameEntry> CurrentGames()
    {
        if (_grade == AllGradesValue)
            return _library.Manifest.Grades
                .OrderBy(g => g.Grade)
                .SelectMany(g => g.Games)
                .ToList();
        return _library.GamesFor(_grade).ToList();
    }

    private void Render()
    {
        RightSide.Children.Clear();
        LeftSide.Children.Clear();

        var games = CurrentGames();
        int total = games.Count;
        int totalSpreads = Math.Max(1, (int)Math.Ceiling(total / (double)TilesPerSpread));
        if (_spreadIndex >= totalSpreads) _spreadIndex = totalSpreads - 1;
        if (_spreadIndex < 0) _spreadIndex = 0;

        int start = _spreadIndex * TilesPerSpread;
        // Persian RTL book: first page is on the right.
        FillPage(RightSide, games, start, TilesPerPage);
        FillPage(LeftSide, games, start + TilesPerPage, TilesPerPage);

        var label = _grade == AllGradesValue ? "همه" : "پایهٔ " + ToPersianDigits(_grade.ToString());
        PageIndicator.Text = $"{label}  —  صفحهٔ {ToPersianDigits((_spreadIndex + 1).ToString())} از {ToPersianDigits(totalSpreads.ToString())}";
    }

    private void FillPage(UniformGrid host, IReadOnlyList<GameEntry> games, int start, int count)
    {
        for (int i = 0; i < count; i++)
        {
            int idx = start + i;
            host.Children.Add(idx < games.Count ? MakeTile(games[idx]) : MakePlaceholder());
        }
    }

    private FrameworkElement MakeTile(GameEntry e)
    {
        var btn = new Button
        {
            Style = (Style)FindResource("GameTile"),
            Tag = e,
        };

        var grid = new Grid();
        grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var imgHost = new Border
        {
            Margin = new Thickness(8, 8, 8, 4),
            CornerRadius = new CornerRadius(8),
            ClipToBounds = true,
            Background = new SolidColorBrush(Color.FromArgb(28, 0, 0, 0)),
        };
        var img = new Image
        {
            Source = LoadImage(e.ImageFile),
            Stretch = Stretch.Uniform,
        };
        imgHost.Child = img;
        Grid.SetRow(imgHost, 0);

        var bottom = new Grid { Margin = new Thickness(10, 4, 10, 10) };
        bottom.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        bottom.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

        var info = new Button
        {
            Style = (Style)FindResource("InfoBadge"),
            ToolTip = "جزئیات",
            VerticalAlignment = VerticalAlignment.Center,
        };
        info.Click += (s, ev) => { ev.Handled = true; ShowInfo(e); };
        Grid.SetColumn(info, 0);

        var nameText = new TextBlock
        {
            Text = e.Name,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            TextTrimming = TextTrimming.CharacterEllipsis,
            FontFamily = (System.Windows.Media.FontFamily)FindResource("ShabnamBoldFont"),
            FontSize = 16,
            Foreground = (Brush)FindResource("LeatherDarkBrush"),
            Margin = new Thickness(8, 0, 8, 0),
        };
        Grid.SetColumn(nameText, 1);

        bottom.Children.Add(info);
        bottom.Children.Add(nameText);
        Grid.SetRow(bottom, 1);

        grid.Children.Add(imgHost);
        grid.Children.Add(bottom);
        btn.Content = grid;

        btn.Click += (_, _) => GameLaunchRequested?.Invoke(this, e);
        return btn;
    }

    private static FrameworkElement MakePlaceholder() => new Border
    {
        Margin = new Thickness(8),
        CornerRadius = new CornerRadius(10),
        BorderBrush = new SolidColorBrush(Color.FromArgb(40, 0, 0, 0)),
        BorderThickness = new Thickness(1),
        Background = new SolidColorBrush(Color.FromArgb(20, 0, 0, 0)),
    };

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

    private void ShowInfo(GameEntry e)
    {
        _infoGame = e;
        InfoTitle.Text = e.Name;
        InfoBody.Text = string.IsNullOrWhiteSpace(e.Description)
            ? "توضیحاتی برای این بازی ثبت نشده است."
            : e.Description;
        InfoOverlay.Visibility = Visibility.Visible;
    }

    private void HideInfo()
    {
        _infoGame = null;
        InfoOverlay.Visibility = Visibility.Collapsed;
    }

    private void Overlay_BackgroundClick(object sender, MouseButtonEventArgs e)
    {
        HideInfo();
        e.Handled = true;
    }

    private void Overlay_PanelClick(object sender, MouseButtonEventArgs e) => e.Handled = true;
    private void InfoClose_Click(object sender, RoutedEventArgs e) => HideInfo();

    private void InfoLaunch_Click(object sender, RoutedEventArgs e)
    {
        if (_infoGame is null) return;
        var g = _infoGame;
        HideInfo();
        GameLaunchRequested?.Invoke(this, g);
    }

    private void PrevPage_Click(object sender, RoutedEventArgs e) { _spreadIndex--; AnimateFlip(-1); }
    private void NextPage_Click(object sender, RoutedEventArgs e) { _spreadIndex++; AnimateFlip(+1); }
    private void Back_Click(object sender, RoutedEventArgs e) => BackRequested?.Invoke(this, EventArgs.Empty);
    private void Exit_Click(object sender, RoutedEventArgs e) => Application.Current.Shutdown();
    private void Minimize_Click(object sender, RoutedEventArgs e) => Window.GetWindow(this).WindowState = WindowState.Minimized;

    private void AnimateFlip(int direction)
    {
        // Persian RTL: Next ⇒ content slides left→right. Prev ⇒ content slides right→left.
        // RenderTransform.X is in screen pixels (positive = visually right).
        var w = SpreadHost.ActualWidth;
        if (w <= 0) { Render(); return; }

        double outX = direction > 0 ? +w : -w;
        double inX  = direction > 0 ? -w : +w;

        var translate = new TranslateTransform(0, 0);
        SpreadHost.RenderTransform = translate;

        var slideOut = new DoubleAnimation(0, outX, TimeSpan.FromMilliseconds(220))
        {
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
        };
        slideOut.Completed += (_, _) =>
        {
            Render();
            translate.X = inX;
            var slideIn = new DoubleAnimation(inX, 0, TimeSpan.FromMilliseconds(260))
            {
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
            };
            translate.BeginAnimation(TranslateTransform.XProperty, slideIn);
        };
        translate.BeginAnimation(TranslateTransform.XProperty, slideOut);
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
