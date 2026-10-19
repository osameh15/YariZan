using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using YariZan.App.Services;
using YariZan.Core;

namespace YariZan.App.Views;

public partial class GamesBookPage : UserControl
{
    public event EventHandler<GameEntry>? GameLaunchRequested;
    public event EventHandler? BackRequested;

    private const int TilesPerPage = 6;
    private const int TilesPerSpread = TilesPerPage * 2;

    private readonly IReadOnlyList<GameEntry> _games;
    private readonly IReadOnlyList<GamePage> _pages;
    private readonly ThumbnailCache _thumbnails = new();
    private bool _turning;
    private int TotalSpreads => Math.Max(1, (_pages.Count + TilesPerSpread - 1) / TilesPerSpread);
    private int _spreadIndex;
    private GameEntry? _infoGame;
    private IInputElement? _modalFocus;
    private const string AboutText = @"مجموعه آموزشی «همراه اولی‌ها»

این مجموعه، همراه و دوست کوچک دانش‌آموزان پایه اول ابتدایی در مسیر یادگیری شیرین مفاهیم پایه‌ای ریاضی است. تمامی بازی‌ها و فعالیت‌های این نرم‌افزار کاملاً بر اساس آخرین محتوای کتاب درسی ریاضی اول ابتدایی طراحی شده‌اند و مفاهیم کلیدی از جمله:

    شمارش و دسته‌بندی (چوب‌خط و اشکال)
    الگویابی و ساخت الگوها
    مفاهیم جمع و تفریق
    مقایسه اعداد (کمتر، بیشتر و مساوی)
    اندازه‌گیری (بلندتر/کوتاه‌تر، سنگین‌تر/سبک‌تر)
    ساعت‌خوانی و تشخیص زمان
    جدول شگفت‌انگیز (سودوکو) و مفاهیم جدول و نمودار

را به‌صورت کاملاً تعاملی، جذاب و هدفمند آموزش می‌دهند.

هر بازی با گرافیک شاد و رنگارنگ، انیمیشن‌های جذاب، فیدبک‌های صوتی و تشویق‌کننده، کودک را غرق در یادگیری کرده و با تکرار و تمرین غیرمستقیم، مهارت‌های ریاضی و اعتمادبه‌نفس او را تقویت می‌کند.

ویژگی‌های برجسته نرم‌افزار:

    پوشش کامل و گام‌به‌گام سرفصل‌های ریاضی پایه اول دبستان
    محیط کاملاً فارسی، ایمن، ساده و کودکانه
    دارای بخش‌های ارزشیابی مستمر برای سنجش یادگیری دانش‌آموز
    ابزاری کارآمد و جذاب برای معلمان گرامی در کلاس‌های هوشمند (Smartboard) و والدین در خانه";

    public GamesBookPage(GameLibrary library)
    {
        _games = library.GamesFor(library.Manifest.SelectedGrade);
        _pages = GamePage.Group(_games);
        InitializeComponent();
        GradeTitle.Text = $"دبستانی ها- {AppBranding.GradeName(library.Manifest.SelectedGrade)} ابتدایی";
        Render();
    }

    private void Render()
    {
        RightSide.Children.Clear();
        LeftSide.Children.Clear();

        var games = _pages;
        int totalSpreads = TotalSpreads;
        if (_spreadIndex >= totalSpreads) _spreadIndex = totalSpreads - 1;
        if (_spreadIndex < 0) _spreadIndex = 0;

        int start = _spreadIndex * TilesPerSpread;
        // Persian RTL book: first page is on the right.
        FillPage(RightSide, games, start, TilesPerPage);
        FillPage(LeftSide, games, start + TilesPerPage, TilesPerPage);

        PageNumber.Text = ToPersianDigits((_spreadIndex + 1).ToString());
        PageTotal.Text = "از " + ToPersianDigits(totalSpreads.ToString());
        UpdateNavigation();
    }

    private void FillPage(UniformGrid host, IReadOnlyList<GamePage> games, int start, int count)
    {
        for (int i = 0; i < count; i++)
        {
            int idx = start + i;
            host.Children.Add(idx < games.Count ? MakeTile(games[idx]) : MakePlaceholder());
        }
    }

    private FrameworkElement MakeTile(GamePage page)
    {
        var e = page.Preview;
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
            Stretch = Stretch.Uniform,
        };
        _ = SetThumbnailAsync(img, e.ImageFile);
        imgHost.Child = img;
        Grid.SetRow(imgHost, 0);

        var bottom = new Grid { Margin = new Thickness(4, 2, 4, 6) };
        bottom.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        bottom.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

        var info = new Button
        {
            Style = (Style)FindResource("InfoBadge"),
            ToolTip = "جزئیات",
            VerticalAlignment = VerticalAlignment.Center,
        };
        info.Click += (s, ev) => { ev.Handled = true; OpenPage(page, true); };
        Grid.SetColumn(info, 0);

        var nameText = new TextBlock
        {
            Text = PersianText.Digits(page.Name),
            ToolTip = PersianText.Digits(page.Games.Count > 1 ? $"{page.Name} — {page.Games.Count} بازی" : page.Name),
            TextWrapping = TextWrapping.Wrap,
            TextAlignment = TextAlignment.Center,
            MaxHeight = 56,
            HorizontalAlignment = HorizontalAlignment.Center,
            VerticalAlignment = VerticalAlignment.Center,
            TextTrimming = TextTrimming.CharacterEllipsis,
            FontFamily = (System.Windows.Media.FontFamily)FindResource("ShabnamBoldFont"),
            FontSize = 13,
            Foreground = (Brush)FindResource("LeatherDarkBrush"),
            Margin = new Thickness(4, 0, 2, 0),
        };
        Grid.SetColumn(nameText, 1);

        bottom.Children.Add(info);
        bottom.Children.Add(nameText);
        Grid.SetRow(bottom, 1);

        grid.Children.Add(imgHost);
        grid.Children.Add(bottom);
        btn.Content = grid;

        btn.Click += (_, _) => OpenPage(page);
        return btn;
    }

    private void OpenPage(GamePage page, bool details = false)
    {
        if (page.Games.Count == 1)
        {
            if (details) ShowInfo(page.Preview);
            else GameLaunchRequested?.Invoke(this, page.Preview);
            return;
        }
        _infoGame = null;
        InfoTitle.Text = PersianText.Digits(page.Name);
        InfoScroll.Visibility = ContactPanel.Visibility = InfoLaunchButton.Visibility = Visibility.Collapsed;
        GameChoices.Children.Clear();
        foreach (var game in page.Games)
        {
            var button = new Button
            {
                Style = (Style)FindResource("GoldButton"),
                Content = new TextBlock { Text = PersianText.Digits(page.ChoiceName(game)), TextWrapping = TextWrapping.Wrap,
                    TextAlignment = TextAlignment.Center },
                Margin = new Thickness(0, 6, 0, 6), Padding = new Thickness(18, 14, 18, 14),
                HorizontalContentAlignment = HorizontalAlignment.Stretch,
                BorderBrush = (Brush)FindResource("LeatherDarkBrush"), BorderThickness = new Thickness(2),
            };
            System.Windows.Automation.AutomationProperties.SetName(button, PersianText.Digits(page.ChoiceName(game)));
            button.Click += (_, _) =>
            {
                HideInfo();
                if (details) ShowInfo(game);
                else GameLaunchRequested?.Invoke(this, game);
            };
            GameChoices.Children.Add(button);
        }
        GameChoiceScroll.Visibility = Visibility.Visible;
        ShowModal();
        ((Button)GameChoices.Children[0]).Focus();
    }

    private static FrameworkElement MakePlaceholder() => new Border
    {
        Margin = new Thickness(8),
        CornerRadius = new CornerRadius(10),
        BorderBrush = new SolidColorBrush(Color.FromArgb(40, 0, 0, 0)),
        BorderThickness = new Thickness(1),
        Background = new SolidColorBrush(Color.FromArgb(20, 0, 0, 0)),
    };

    private async Task SetThumbnailAsync(Image image, string relative)
    {
        var thumbnail = await _thumbnails.GetAsync(relative).ConfigureAwait(false);
        await image.Dispatcher.InvokeAsync(() => image.Source = thumbnail);
    }

    private void ShowInfo(GameEntry e)
    {
        GameChoiceScroll.Visibility = Visibility.Collapsed;
        ContactPanel.Visibility = Visibility.Collapsed;
        InfoScroll.Visibility = Visibility.Visible;
        _infoGame = e;
        InfoTitle.Text = PersianText.Digits(e.Name);
        InfoBody.Text = string.IsNullOrWhiteSpace(e.Description)
            ? "توضیحاتی برای این بازی ثبت نشده است."
            : PersianText.Digits(e.Description);
        InfoLaunchButton.Visibility = Visibility.Visible;
        InfoScroll.VerticalScrollBarVisibility = ScrollBarVisibility.Auto;
        ShowModal();
    }

    private void About_Click(object sender, RoutedEventArgs e)
    {
        GameChoiceScroll.Visibility = Visibility.Collapsed;
        ContactPanel.Visibility = Visibility.Collapsed;
        InfoScroll.Visibility = Visibility.Visible;
        _infoGame = null;
        InfoTitle.Text = "دربارهٔ مجموعه";
        InfoBody.Text = AboutText;
        InfoLaunchButton.Visibility = Visibility.Collapsed;
        InfoScroll.VerticalScrollBarVisibility = ScrollBarVisibility.Hidden;
        ShowModal();
    }

    private void Contact_Click(object sender, RoutedEventArgs e)
    {
        GameChoiceScroll.Visibility = Visibility.Collapsed;
        _infoGame = null;
        InfoTitle.Text = "ارتباط با ما";
        InfoScroll.Visibility = InfoLaunchButton.Visibility = Visibility.Collapsed;
        ContactPanel.Visibility = Visibility.Visible;
        ContactFeedback.Text = "";
        ShowModal();
    }

    private void StudioWebsite_Click(object sender, RoutedEventArgs e) => OpenContactWebsite("https://oarnova.games/");
    private void YarizanWebsite_Click(object sender, RoutedEventArgs e) => OpenContactWebsite("https://yarizan.oarnova.games/");

    private void OpenContactWebsite(string url)
    {
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
            ContactFeedback.Text = "";
        }
        catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException)
        {
            ContactFeedback.Text = "مرورگر باز نشد. نشانی وب‌سایت را در مرورگر وارد کنید.";
        }
    }

    private void ShowModal()
    {
        _modalFocus = Keyboard.FocusedElement;
        BookContent.IsEnabled = false;
        InfoOverlay.Visibility = Visibility.Visible;
        InfoScroll.ScrollToTop();
        InfoCloseButton.Focus();
    }

    private void Modal_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape && InfoOverlay.Visibility == Visibility.Visible)
        {
            HideInfo();
            e.Handled = true;
        }
    }

    private void HideInfo()
    {
        _infoGame = null;
        InfoOverlay.Visibility = Visibility.Collapsed;
        GameChoiceScroll.Visibility = Visibility.Collapsed;
        BookContent.IsEnabled = true;
        if (_modalFocus is not null) Keyboard.Focus(_modalFocus);
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

    private void PrevPage_Click(object sender, RoutedEventArgs e) => NavigateTo(_spreadIndex - 1);
    private void NextPage_Click(object sender, RoutedEventArgs e) => NavigateTo(_spreadIndex + 1);
    private void Back_Click(object sender, RoutedEventArgs e) => BackRequested?.Invoke(this, EventArgs.Empty);
    private void Exit_Click(object sender, RoutedEventArgs e) => Application.Current.Shutdown();
    private void Minimize_Click(object sender, RoutedEventArgs e) => Window.GetWindow(this).WindowState = WindowState.Minimized;

    private void UpdateNavigation()
    {
        PreviousButton.IsEnabled = !_turning && _spreadIndex > 0;
        NextButton.IsEnabled = !_turning && _spreadIndex + 1 < TotalSpreads;
        PageNumber.IsEnabled = JumpButton.IsEnabled = !_turning;
    }

    private void NavigateTo(int index)
    {
        if (_turning || index < 0 || index >= TotalSpreads || index == _spreadIndex) return;
        int direction = index > _spreadIndex ? 1 : -1;
        _spreadIndex = index;
        _turning = true;
        UpdateNavigation();
        SpreadHost.IsHitTestVisible = false;
        // Start background decoding before the fold reaches the spine.
        foreach (var page in _pages.Skip(index * TilesPerSpread).Take(TilesPerSpread))
            _ = _thumbnails.GetAsync(page.Preview.ImageFile);
        var target = direction > 0 ? LeftSide : RightSide;
        // WPF mirrors transform origins under RTL: these origins sit at the book spine.
        target.RenderTransformOrigin = new Point(direction > 0 ? 0 : 1, 0.5);
        var scale = new ScaleTransform(1, 1);
        var skew = new SkewTransform();
        var transforms = new TransformGroup();
        transforms.Children.Add(scale);
        transforms.Children.Add(skew);
        target.RenderTransform = transforms;
        double lift = direction > 0 ? -8 : 8;
        var fold = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(170))
        {
            EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
        };
        fold.Completed += (_, _) =>
        {
            Render();
            var unfold = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(200))
            {
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
            };
            unfold.Completed += (_, _) =>
            {
                target.RenderTransform = Transform.Identity;
                SpreadHost.IsHitTestVisible = true;
                _turning = false;
                UpdateNavigation();
            };
            scale.BeginAnimation(ScaleTransform.ScaleXProperty, unfold);
            skew.BeginAnimation(SkewTransform.AngleYProperty,
                new DoubleAnimation(lift, 0, TimeSpan.FromMilliseconds(200)));
        };
        scale.BeginAnimation(ScaleTransform.ScaleXProperty, fold);
        skew.BeginAnimation(SkewTransform.AngleYProperty,
            new DoubleAnimation(0, lift, TimeSpan.FromMilliseconds(170)));
    }

    private void Jump_Click(object sender, RoutedEventArgs e) => JumpToPage();

    private void PageNumber_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter) return;
        JumpToPage();
        e.Handled = true;
    }

    private void JumpToPage()
    {
        var normalized = new string(PageNumber.Text.Trim().Select(c =>
            c >= '۰' && c <= '۹' ? (char)('0' + c - '۰') :
            c >= '٠' && c <= '٩' ? (char)('0' + c - '٠') : c).ToArray());
        if (int.TryParse(normalized, out int page) && page >= 1 && page <= TotalSpreads)
        {
            PageNumber.ToolTip = "شمارهٔ صفحه را وارد کنید و Enter بزنید";
            NavigateTo(page - 1);
            PageNumber.Text = ToPersianDigits(page.ToString());
        }
        else
        {
            PageNumber.ToolTip = $"شماره‌ای بین ۱ و {ToPersianDigits(TotalSpreads.ToString())} وارد کنید";
            PageNumber.Text = ToPersianDigits((_spreadIndex + 1).ToString());
            PageNumber.Focus();
            PageNumber.SelectAll();
        }
    }

    private static string ToPersianDigits(string s)
        => PersianText.Digits(s);
}
