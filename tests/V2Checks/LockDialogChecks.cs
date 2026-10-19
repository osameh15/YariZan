using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using YariZan.App.Services;
using YariZan.App.Views;
using YariZan.Core.V2;

internal static partial class Program
{
    private sealed class RecordingDesktopActions : ILockDesktopActions
    {
        public string? Copied;
        public Uri? Opened;
        public bool FailCopy, FailBrowser;
        public int BrowserCalls;
        public void OpenConnectPage() { BrowserCalls++; if(FailBrowser)throw new IOException("Browser unavailable in test"); Opened=DesktopProvisioningClient.ConnectPage; }
        public void CopyText(string text) { if (FailCopy) throw new IOException("Clipboard unavailable in test"); Copied = text; }
        public void OpenProductPage(Uri destination)
        { BrowserCalls++; if (FailBrowser) throw new IOException("Browser unavailable in test"); StoreDestinations.ValidateDestination(destination); Opened = destination; }
    }
    private static StoreDestinations TestStore(int grade = 1) => StoreDestinations.Read(JsonSerializer.Serialize(new
    {
        format = "YARIZAN-STORE-DESTINATIONS-V1", operational = true, review_reference = "test-only-mocked-browser",
        product_pages = new Dictionary<string, string> { [$"YARIZAN-G{grade}"] = $"https://yarizan.oarnova.games/products/yarizan-g{grade}" }
    }));

    private static void LockDialogChecks(SigningFixture signing, IDeviceIdentity identity, string screenshots)
    {
        Check(StoreDestinations.LoadEmbedded().ForGrade(1) is null, "distributed store remains explicitly non-operational; no website launch default");
        Check(Enumerable.Range(1, 6).All(g => TestStore(g).ForGrade(g)?.AbsolutePath == $"/products/yarizan-g{g}"), "reviewed HTTPS destinations preserve G1-G6 product binding");
        foreach (string bad in new[] { "http://yarizan.oarnova.games/products/yarizan-g1", "https://evil.example/products/yarizan-g1",
            "https://yarizan.oarnova.games:8443/products/yarizan-g1", "https://user:secret@yarizan.oarnova.games/products/yarizan-g1",
            "https://yarizan.oarnova.games/products/yarizan-g1?credential=secret", "https://yarizan.oarnova.games/products/yarizan-g1#secret",
            "file:///C:/Windows/notepad.exe", "javascript:alert(1)", "https://yarizan.oarnova.games/products/yarizan-g2" })
        {
            string config = JsonSerializer.Serialize(new { format = "YARIZAN-STORE-DESTINATIONS-V1", operational = true,
                review_reference = "test-only", product_pages = new Dictionary<string, string> { ["YARIZAN-G1"] = bad } });
            Check(Reject(() => StoreDestinations.Read(config)), "unapproved or cross-grade store destination rejected");
        }
        Check(Reject(() => StoreDestinations.Read("{\"format\":\"YARIZAN-STORE-DESTINATIONS-V1\",\"operational\":true,\"review_reference\":\"\",\"product_pages\":{}}")),
            "operational flag alone cannot enable unreviewed checkout");
        Check(Reject(() => new WindowsLockDesktopActions().OpenProductPage(new Uri("file:///C:/Windows/notepad.exe"))),
            "actual OS browser boundary rejects unsafe scheme before Process.Start");

        var server = new FakeServer(signing, identity);
        using var access = Access(identity, signing, Store("dialog-ui"), server);
        var desktop = new RecordingDesktopActions();
        var page = new LockPage(access, desktop, StoreDestinations.Unavailable);
        var host = new Window { Content = page, Width = 1216, Height = 779, ShowInTaskbar = false, Left = -32000, Top = -32000 };
        host.Show(); host.Activate(); Pump(() => access.State == DesktopAccessState.TrialAvailable);
        T C<T>(string name) where T : FrameworkElement => (T)page.FindName(name);
        foreach (string field in new[] { "HwidText", "ActivationCodeInput", "PairingIdText", "PairingCodeText", "PreparedMessageText" })
            Check(NumberSubstitution.GetSubstitution(C<FrameworkElement>(field)) == NumberSubstitutionMethod.European,
                "English digits retained for identity/code field: " + field);
        void Click(string name) => C<Button>(name).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        void KeyPress(Key key, UIElement target) => target.RaiseEvent(new KeyEventArgs(Keyboard.PrimaryDevice,
            PresentationSource.FromVisual(host), Environment.TickCount, key) { RoutedEvent = Keyboard.PreviewKeyDownEvent });
        void Wheel(UIElement target) => target.RaiseEvent(new MouseWheelEventArgs(Mouse.PrimaryDevice, Environment.TickCount, -120)
            { RoutedEvent = Mouse.PreviewMouseWheelEvent });
        void Layout(int width, int height)
        { page.Width = width; page.Height = height; host.Width = width + 16; host.Height = height + 39;
            page.Measure(new Size(width, height)); page.Arrange(new Rect(0, 0, width, height)); page.UpdateLayout(); }
        void Capture(string name, int width = 1200, int height = 740)
        { Layout(width, height); Save(page, screenshots, name, width, height); }
        bool ModalOpen() => C<Grid>("ModalOverlay").Visibility == Visibility.Visible;
        Check(C<Button>("PurchaseButton").Content.ToString() == "راهنمای خرید", "non-operational store labels temporary action as purchase assistance");
        Check(page.FindName("SupportCard") is null, "redundant bottom support card removed");
        Capture("lock-final-normal.png");
        Click("PurchaseButton");
        Check(ModalOpen() && C<TextBlock>("ModalTitle").Text == "راهنمای خرید — پایه اول" && desktop.BrowserCalls == 0,
            "purchase click opens actionable selected-grade dialog instead of unavailable website");
        Check(!C<ScrollViewer>("LockScroll").IsEnabled && C<StackPanel>("ContactPanel").IsVisible, "purchase dialog disables background while exposing support actions");
        Click("CopyPhoneButton");
        Check(desktop.Copied == "0918-876-4024" && C<TextBlock>("ModalFeedback").Text == "شماره پشتیبانی کپی شد.", "purchase copy phone action writes number and visible success");
        Click("CopyPreparedButton");
        Check(desktop.Copied == $"سلام\nدرخواست خرید یاریزان — پایه اول\nشناسه کاربری: {identity.Username}\nسپاسگزارم",
            "purchase request action copies selected grade and only public identity");
        Capture("lock-final-purchase.png");
        KeyPress(Key.Escape, C<Button>("CloseModalButton"));
        Check(!ModalOpen() && C<ScrollViewer>("LockScroll").IsEnabled && Keyboard.FocusedElement == C<Button>("PurchaseButton"),
            "Escape closes purchase dialog and restores trigger keyboard focus");
        Click("SupportButton");
        Check(ModalOpen() && C<TextBlock>("ModalTitle").Text == "پشتیبانی یاریزان — پایه اول", "support click opens real support dialog");
        Click("CopyPreparedButton");
        Check(desktop.Copied == $"سلام\nدرخواست پشتیبانی یاریزان — پایه اول\nشناسه کاربری: {identity.Username}\nسپاسگزارم"
            && C<TextBlock>("ModalFeedback").Text == "پیام آماده کپی شد.", "support message action copies grade/public username with feedback");
        desktop.FailCopy = true; Click("CopyPhoneButton");
        Check(C<TextBlock>("ModalFeedback").Text == "کپی نشد؛ دوباره تلاش کنید.", "clipboard failure reports visible inline error without closing dialog");
        desktop.FailCopy = false; Click("CopyPhoneButton"); Capture("lock-final-support.png");
        Click("CloseModalButton");
        Check(Keyboard.FocusedElement == C<Button>("SupportButton"), "close button restores support trigger focus");
        Click("ManualCodeButton");
        Check(Keyboard.FocusedElement == C<TextBox>("ActivationCodeInput"), "manual modal opens with actual keyboard focus in code field");
        C<TextBox>("ActivationCodeInput").Text = "yz2-aaaa-aaaa-aaaa-aaaa-aaaa-aaaa-aaaa-aaaa";
        Check(C<TextBox>("ActivationCodeInput").Text.StartsWith("yz2-"), "modal accepts editable LTR code input");
        var input = C<TextBox>("ActivationCodeInput");
        Check(((SolidColorBrush)input.Background).Color == Color.FromRgb(250, 239, 207) && ((SolidColorBrush)input.SelectionBrush).Color == Color.FromRgb(201, 164, 92),
            "manual input uses warm parchment and gold selection palette");
        for (int i = 0; i < 6; i++)
        {
            ((FrameworkElement)Keyboard.FocusedElement).MoveFocus(new TraversalRequest(FocusNavigationDirection.Next));
            Check(C<Grid>("ModalOverlay").IsKeyboardFocusWithin, "Tab traversal stays within manual modal " + i);
        }
        C<Button>("CloseModalButton").Focus();
        C<Button>("CloseModalButton").MoveFocus(new TraversalRequest(FocusNavigationDirection.Next));
        Check(Keyboard.FocusedElement == input, "last modal control Tab cycles back to input");
        Click("TrialButton");
        Check(server.Used() == 0 && !access.CanEnter, "modal blocks background trial action even on synthetic click");
        Capture("lock-final-manual-code.png");
        KeyPress(Key.Escape, input);
        Check(!ModalOpen() && input.Text == "" && Keyboard.FocusedElement == C<Button>("ManualCodeButton"),
            "Escape clears code and restores manual trigger focus");

        foreach (var size in new[] { new Size(640, 480), new Size(480, 360), new Size(320, 240) })
        {
            Layout((int)size.Width, (int)size.Height);
            var background = C<ScrollViewer>("LockScroll");
            Check(background.VerticalScrollBarVisibility == ScrollBarVisibility.Hidden && background.ComputedVerticalScrollBarVisibility == Visibility.Collapsed
                && background.ScrollableWidth == 0, "background scrollbar visually hidden without horizontal overflow " + size);
            background.ScrollToTop(); page.UpdateLayout();
            Wheel(background); page.UpdateLayout();
            Check(background.VerticalOffset > 0, "mouse wheel scrolls hidden background overflow " + size);
            KeyPress(Key.PageDown, C<Button>("ManualCodeButton")); page.UpdateLayout();
            Check(background.VerticalOffset > 0, "keyboard PageDown accesses background overflow " + size);
            double offset = background.VerticalOffset; double extent = background.ExtentHeight;
            Click("ManualCodeButton"); page.UpdateLayout();
            var modal = C<ScrollViewer>("ModalScroll");
            var card = C<Border>("ModalCard"); var bounds = card.TransformToAncestor(page).TransformBounds(new Rect(card.RenderSize));
            Check(Math.Abs(background.VerticalOffset - offset) < 0.1 && Math.Abs(background.ExtentHeight - extent) < 0.1,
                "opening modal preserves background height and viewport " + size);
            Check(bounds.Left >= 0 && bounds.Right <= size.Width && bounds.Top >= 0 && bounds.Bottom <= size.Height,
                "modal card fits small viewport bounds " + size);
            Check(modal.VerticalScrollBarVisibility == ScrollBarVisibility.Hidden && modal.ComputedVerticalScrollBarVisibility == Visibility.Collapsed
                && modal.ScrollableWidth == 0 && modal.PanningMode == PanningMode.VerticalOnly, "modal hides scrollbar while preserving vertical touch configuration " + size);
            // Long real error text exercises internal overflow without enlarging the outer card.
            C<TextBlock>("CodeFeedback").Text = string.Join(" ", Enumerable.Repeat("کد فعال‌سازی معتبر نیست یا برای این نسخه صادر نشده است.", 20)); page.UpdateLayout();
            modal.ScrollToTop(); page.UpdateLayout(); Wheel(input); page.UpdateLayout();
            Check(modal.ScrollableHeight > 0 && modal.VerticalOffset > 0 && Math.Abs(background.VerticalOffset - offset) < 0.1,
                "wheel over code field scrolls modal overflow without moving background " + size);
            modal.ScrollToTop(); page.UpdateLayout(); KeyPress(Key.PageDown, input); page.UpdateLayout();
            Check(modal.VerticalOffset > 0, "PageDown scrolls modal overflow " + size);
            C<Button>("RedeemButton").Focus(); page.UpdateLayout();
            var buttonBounds = C<Button>("RedeemButton").TransformToAncestor(modal).TransformBounds(new Rect(C<Button>("RedeemButton").RenderSize));
            Check(buttonBounds.Bottom <= modal.ActualHeight + 1 && buttonBounds.Left >= 0,
                "keyboard focus brings redemption action into modal viewport " + size);
            if (size.Width == 480)
            {
                C<TextBlock>("CodeFeedback").Text = "کد فعال‌سازی معتبر نیست یا برای این نسخه صادر نشده است.";
                modal.ScrollToTop(); input.Focus(); page.UpdateLayout();
                Save(page, screenshots, "lock-final-small.png", 480, 360);
                var bitmap = new RenderTargetBitmap(960, 720, 192, 192, PixelFormats.Pbgra32); bitmap.Render(page);
                var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
                using var file = File.Create(Path.Combine(screenshots, "lock-final-small-192dpi.png")); encoder.Save(file);
                Check(bitmap.DpiX == 192 && bitmap.PixelWidth == 960, "small dialog renders at 192 DPI with doubled physical pixel dimensions");
            }
            KeyPress(Key.Escape, C<Button>("CloseModalButton")); page.UpdateLayout();
            Check(!ModalOpen() && Math.Abs(background.VerticalOffset - offset) < 0.1,
                "closing modal restores exact small background viewport " + size);
        }
        // Closing a pending request cancels it; no delayed activation may occur afterward.
        Layout(1200, 740); server.PendingRedemption = new(TaskCreationOptions.RunContinuationsAsynchronously);
        Click("ManualCodeButton"); input.Text = FakeServer.ValidCode; Click("RedeemButton");
        Check(!C<Button>("RedeemButton").IsEnabled && ModalOpen(), "pending redemption disables duplicate submit while close remains usable");
        KeyPress(Key.Escape, C<Button>("CloseModalButton"));
        Pump(() => C<Button>("RedeemButton").IsEnabled);
        Check(!ModalOpen() && !access.CanEnter, "Escape cancels pending redemption without granting access");
        host.Close();

        var delayedServer = new FakeServer(signing, identity) { PendingStatus = new(TaskCreationOptions.RunContinuationsAsynchronously) };
        using var delayedAccess = Access(identity, signing, Store("dialog-delayed-status"), delayedServer);
        var delayedPage = new LockPage(delayedAccess, desktop, StoreDestinations.Unavailable);
        var delayedHost = new Window { Content = delayedPage, Width = 820, Height = 740, ShowInTaskbar = false, Left = -32000, Top = -32000 };
        delayedHost.Show(); delayedHost.Activate();
        ((Button)delayedPage.FindName("ManualCodeButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(Keyboard.FocusedElement == (TextBox)delayedPage.FindName("ActivationCodeInput"), "manual code field receives focus even while trial status lookup is pending");
        var delayedBackground = (ScrollViewer)delayedPage.FindName("LockScroll");
        double delayedExtent = delayedBackground.ExtentHeight;
        delayedServer.PendingStatus.SetResult(2); Pump(() => delayedAccess.State == DesktopAccessState.TrialAvailable);
        delayedPage.UpdateLayout();
        Check(Math.Abs(delayedBackground.ExtentHeight - delayedExtent) < 0.1, "delayed status result does not relayout background underneath modal");
        ((Button)delayedPage.FindName("CloseModalButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        delayedServer.PendingPickup = new(TaskCreationOptions.RunContinuationsAsynchronously); delayedServer.EntitlementState = "ACTIVE";
        ((Button)delayedPage.FindName("ActivateButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Pump(() => delayedServer.PickupRequests == 1);
        ((Button)delayedPage.FindName("SupportButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        ((Button)delayedPage.FindName("CloseModalButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Check(!delayedAccess.CanEnter && ((FrameworkElement)delayedPage.FindName("ActivationProgressPanel")).IsVisible
            && !((Button)delayedPage.FindName("ActivateButton")).IsVisible && delayedServer.PickupRequests == 1,
            "closing support does not cancel an unrelated pending automatic pickup");
        delayedServer.PendingPickup.SetResult(signing.License(identity)); Pump(() => delayedAccess.IsPurchased);
        Check(delayedAccess.CanEnter, "automatic pickup completes after support dialog was dismissed");
        delayedHost.Close();

        for (int grade = 1; grade <= 6; grade++)
        {
            desktop.FailBrowser = false;
            using var configuredAccess = Access(identity, signing, Store("configured-store-ui-" + grade), server, grade);
            var configuredPage = new LockPage(configuredAccess, desktop, TestStore(grade));
            var configuredHost = new Window { Content = configuredPage, Width = 820, Height = 740, ShowInTaskbar = false, Left = -32000, Top = -32000 };
            configuredHost.Show();
            ((Button)configuredPage.FindName("PurchaseButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            Check(desktop.Opened?.AbsoluteUri == $"https://yarizan.oarnova.games/products/yarizan-g{grade}"
                && ((Grid)configuredPage.FindName("ModalOverlay")).Visibility == Visibility.Collapsed,
                "configured operational purchase click invokes correct HTTPS browser destination G" + grade);
            if (grade == 1)
            {
                desktop.FailBrowser = true; ((Button)configuredPage.FindName("PurchaseButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
                Check(((Grid)configuredPage.FindName("ModalOverlay")).Visibility == Visibility.Visible
                    && ((TextBlock)configuredPage.FindName("ModalFeedback")).Text.Contains("صفحه خرید باز نشد"), "browser failure falls back to actionable purchase assistance");
            }
            configuredHost.Close();
        }
        // Exercise the actual Windows clipboard service without printing prior clipboard content.
        // The injected writer tests above cover success/failure deterministically on every runner.
        IDataObject? previous = null;
        bool captured = false;
        try
        {
            previous = Clipboard.GetDataObject(); captured = true;
            var windows = new WindowsLockDesktopActions();
            windows.CopyText("0918-876-4024");
            Check(Clipboard.GetText() == "0918-876-4024", "actual Windows clipboard service round-trips support phone");
            string publicMessage = $"درخواست پشتیبانی پایه اول\nشناسه کاربری: {identity.Username}";
            windows.CopyText(publicMessage);
            Check(Clipboard.GetText() == publicMessage, "actual Windows clipboard service round-trips public support message");
            Console.WriteLine("EVIDENCE Windows clipboard round-trip executed successfully; no clipboard content logged.");
        }
        catch (System.Runtime.InteropServices.ExternalException)
        { Console.WriteLine("EVIDENCE Windows clipboard unavailable; physical clipboard round-trip NOT executed. Injected action/error tests passed."); }
        finally
        {
            if (captured)
            {
                try { if (previous is null) Clipboard.Clear(); else Clipboard.SetDataObject(previous, true); }
                catch (System.Runtime.InteropServices.ExternalException) { Console.WriteLine("EVIDENCE Previous clipboard could not be restored; OS clipboard unavailable."); }
            }
        }
    }
}
