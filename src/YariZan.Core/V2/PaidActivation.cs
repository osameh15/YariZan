using System.Globalization;
using System.Net.Http;
using System.Text.Json;

namespace YariZan.Core.V2;

public enum PaidActivationPhase
{
    Idle, Checking, WaitingForPurchase, RetrievingLicense, Activated, NetworkUnavailable, RateLimited, Paused,
    EnrollmentRequired, ProductBlocked, ProductUnavailable, AccountRestricted, LicenseRevoked, InvalidLicense, Cancelled
}

/// <summary>StartupRecovery is one bounded check at launch; Waiting is the visible, cancellable payment wait.</summary>
public enum PaidActivationMode { None, StartupRecovery, Waiting }

public sealed record PaidActivationTiming
{
    public TimeSpan FirstInterval { get; init; } = TimeSpan.FromSeconds(10);
    public TimeSpan SteadyInterval { get; init; } = TimeSpan.FromSeconds(15);
    public int FirstIntervalChecks { get; init; } = 6;
    public TimeSpan Jitter { get; init; } = TimeSpan.FromSeconds(3);
    public TimeSpan NetworkBackoffStart { get; init; } = TimeSpan.FromSeconds(10);
    public TimeSpan NetworkBackoffMax { get; init; } = TimeSpan.FromSeconds(60);
    public TimeSpan RateLimitDelay { get; init; } = TimeSpan.FromSeconds(60);
    public TimeSpan AttemptDeadline { get; init; } = TimeSpan.FromSeconds(30);
    public TimeSpan StartupDeadline { get; init; } = TimeSpan.FromSeconds(20);
    public TimeSpan MaxWait { get; init; } = TimeSpan.FromMinutes(30);
    public static PaidActivationTiming Default { get; } = new();
}

/// <summary>
/// Remembers only that the customer chose to wait for a purchase, so the wait resumes after a restart.
/// It is a UX hint, never a payment status: access policy never reads it.
/// </summary>
public interface IActivationIntentStore
{
    bool IsPending(Product product);
    void MarkPending(Product product);
    void Clear(Product product);
}

public sealed class MemoryActivationIntentStore : IActivationIntentStore
{
    private readonly HashSet<string> _pending = new();
    public bool IsPending(Product product) { lock (_pending) return _pending.Contains(product.Sku); }
    public void MarkPending(Product product) { lock (_pending) _pending.Add(product.Sku); }
    public void Clear(Product product) { lock (_pending) _pending.Remove(product.Sku); }
}

public sealed class FileActivationIntentStore : IActivationIntentStore
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);
    private readonly string _root;
    private readonly Func<DateTimeOffset> _clock;
    public FileActivationIntentStore(string? root = null, Func<DateTimeOffset>? clock = null)
    {
        _root = Path.GetFullPath(root ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OARNOVA", "YariZan", "V2"));
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
    }
    private string PathFor(Product product) => Path.Combine(_root, product.Sku + ".awaiting-purchase");
    public bool IsPending(Product product)
    {
        try
        {
            var info = new FileInfo(PathFor(product));
            if (!info.Exists || info.Length > 64) return false;
            var marked = DateTimeOffset.ParseExact(File.ReadAllText(info.FullName).Trim(), "O", CultureInfo.InvariantCulture);
            var age = _clock() - marked;
            if (age >= TimeSpan.Zero && age < Lifetime) return true;
            Clear(product);
            return false;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or FormatException) { return false; }
    }
    public void MarkPending(Product product)
    {
        try { Directory.CreateDirectory(_root); File.WriteAllText(PathFor(product), _clock().ToString("O", CultureInfo.InvariantCulture)); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
    public void Clear(Product product)
    {
        try { File.Delete(PathFor(product)); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
}

/// <summary>
/// Schedules automatic purchased-license checks for one access controller. It never decides access:
/// every attempt goes through DesktopAccessController, which unlocks only after a verified signed
/// license is durably stored. One session and one request at a time; cancelled on Stop or Dispose.
/// Continuations resume on the caller's synchronization context (the WPF dispatcher in the app).
/// </summary>
public sealed class PaidActivationCoordinator : IDisposable
{
    private readonly DesktopAccessController _access;
    private readonly Product _product;
    private readonly IActivationIntentStore _intent;
    private readonly PaidActivationTiming _timing;
    private readonly Func<TimeSpan, CancellationToken, Task> _delay;
    private readonly Func<double> _random;
    private readonly Func<DateTimeOffset> _clock;
    private readonly object _gate = new();
    private CancellationTokenSource? _session;
    private TaskCompletionSource? _wake;
    private Task _running = Task.CompletedTask;
    private int _generation;
    private bool _disposed;

    public PaidActivationPhase Phase { get; private set; } = PaidActivationPhase.Idle;
    public PaidActivationMode Mode { get; private set; } = PaidActivationMode.None;
    public bool IsRunning { get { lock (_gate) return _session is not null; } }
    public int Attempts { get; private set; }
    public event EventHandler? Changed;
    public event EventHandler? Activated;

    public PaidActivationCoordinator(DesktopAccessController access, IActivationIntentStore? intent = null,
        PaidActivationTiming? timing = null, Func<TimeSpan, CancellationToken, Task>? delay = null,
        Func<double>? random = null, Func<DateTimeOffset>? clock = null)
    {
        _access = access; _product = new Product(access.Grade);
        _intent = intent ?? new MemoryActivationIntentStore();
        _timing = timing ?? PaidActivationTiming.Default;
        _delay = delay ?? Task.Delay;
        _random = random ?? Random.Shared.NextDouble;
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
    }

    /// <summary>The customer chose to wait in an earlier session and has not cancelled.</summary>
    public bool HasPendingIntent => !_disposed && _intent.IsPending(_product);

    /// <summary>Allowed only for an enrolled, not locally revoked device that is not already purchased.</summary>
    public bool CanCheckOnline => !_disposed && !_access.IsPurchased && _access.HasLocalEnrollment
        && _access.LocalLicenseState != DesktopAccessState.Revoked;

    /// <summary>One bounded check at launch. Returns when the check finishes.</summary>
    public Task StartStartupRecoveryAsync()
    {
        int generation;
        CancellationToken token;
        lock (_gate)
        {
            if (_disposed || _session is not null || !CanCheckOnline) return _running;
            (generation, token) = Begin(PaidActivationMode.StartupRecovery);
        }
        return _running = RunAsync(generation, token);
    }

    /// <summary>Starts (or continues) the visible wait. A running startup check is promoted, not restarted.</summary>
    public Task StartWaitingAsync()
    {
        int generation;
        CancellationToken token;
        lock (_gate)
        {
            if (_disposed || _access.IsPurchased) return _running;
            _intent.MarkPending(_product);
            if (_session is not null) { Mode = PaidActivationMode.Waiting; _wake?.TrySetResult(); return _running; }
            (generation, token) = Begin(PaidActivationMode.Waiting);
        }
        return _running = RunAsync(generation, token);
    }

    /// <summary>Checks immediately inside a running wait, or starts a new wait.</summary>
    public Task CheckNowAsync()
    {
        lock (_gate)
        {
            if (_session is not null && Mode == PaidActivationMode.Waiting) { _wake?.TrySetResult(); return _running; }
        }
        return StartWaitingAsync();
    }

    /// <summary>Stops polling. clearIntent=true is an explicit customer cancellation.</summary>
    public void Stop(bool clearIntent)
    {
        bool changed;
        lock (_gate)
        {
            if (clearIntent) _intent.Clear(_product);
            changed = _session is not null || clearIntent;
            _generation++;
            _session?.Cancel(); _session?.Dispose(); _session = null; _wake = null;
            if (changed && Phase != PaidActivationPhase.Activated) { Phase = PaidActivationPhase.Cancelled; Mode = PaidActivationMode.None; }
        }
        if (changed) Changed?.Invoke(this, EventArgs.Empty);
    }

    private (int, CancellationToken) Begin(PaidActivationMode mode)
    {
        var session = new CancellationTokenSource();
        _session = session; _wake = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        Mode = mode; Attempts = 0;
        return (++_generation, session.Token);
    }

    private bool Current(int generation) { lock (_gate) return !_disposed && generation == _generation; }

    private void Set(int generation, PaidActivationPhase phase)
    {
        lock (_gate) { if (_disposed || generation != _generation) return; Phase = phase; }
        Changed?.Invoke(this, EventArgs.Empty);
    }

    private async Task RunAsync(int generation, CancellationToken token)
    {
        var started = _clock();
        int networkFailures = 0;
        try
        {
            while (true)
            {
                token.ThrowIfCancellationRequested();
                Set(generation, PaidActivationPhase.Checking);
                Attempts++;
                PaidActivationPhase outcome;
                TimeSpan? retryAfter = null;
                using (var deadline = CancellationTokenSource.CreateLinkedTokenSource(token))
                {
                    deadline.CancelAfter(Mode == PaidActivationMode.StartupRecovery ? _timing.StartupDeadline : _timing.AttemptDeadline);
                    try
                    {
                        var result = await _access.CheckPurchasedLicenseAsync(deadline.Token,
                            () => Set(generation, PaidActivationPhase.RetrievingLicense));
                        outcome = result switch
                        {
                            PaidCheckOutcome.Activated => PaidActivationPhase.Activated,
                            PaidCheckOutcome.LicenseRevoked => PaidActivationPhase.LicenseRevoked,
                            PaidCheckOutcome.InvalidLicense => PaidActivationPhase.InvalidLicense,
                            _ => PaidActivationPhase.WaitingForPurchase
                        };
                    }
                    catch (OperationCanceledException) when (!token.IsCancellationRequested) { outcome = PaidActivationPhase.NetworkUnavailable; }
                    catch (Exception ex) when (ex is not OperationCanceledException) { outcome = Classify(ex, out retryAfter); }
                }
                token.ThrowIfCancellationRequested();
                if (!Current(generation)) return;
                if (outcome == PaidActivationPhase.Activated && _access.IsPurchased)
                {
                    _intent.Clear(_product);
                    Finish(generation, PaidActivationPhase.Activated);
                    Activated?.Invoke(this, EventArgs.Empty);
                    return;
                }
                if (outcome is not (PaidActivationPhase.WaitingForPurchase or PaidActivationPhase.NetworkUnavailable or PaidActivationPhase.RateLimited))
                {
                    // Revoked, blocked, restricted, unenrolled or invalid: stop; never retry into a different answer.
                    _intent.Clear(_product);
                    Finish(generation, outcome);
                    return;
                }
                networkFailures = outcome == PaidActivationPhase.NetworkUnavailable ? networkFailures + 1 : 0;
                if (Mode != PaidActivationMode.Waiting) { Finish(generation, outcome); return; }
                if (_clock() - started >= _timing.MaxWait) { Finish(generation, PaidActivationPhase.Paused); return; }
                Set(generation, outcome);
                await WaitAsync(NextDelay(outcome, networkFailures, retryAfter), token);
            }
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested) { }
    }

    private void Finish(int generation, PaidActivationPhase phase)
    {
        lock (_gate)
        {
            if (_disposed || generation != _generation) return;
            Phase = phase;
            _session?.Dispose(); _session = null; _wake = null;
        }
        Changed?.Invoke(this, EventArgs.Empty);
    }

    private async Task WaitAsync(TimeSpan delay, CancellationToken token)
    {
        Task wake;
        lock (_gate) wake = _wake?.Task ?? Task.CompletedTask;
        await Task.WhenAny(_delay(delay, token), wake);
        lock (_gate) if (_wake?.Task.IsCompleted == true) _wake = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        token.ThrowIfCancellationRequested();
    }

    private TimeSpan NextDelay(PaidActivationPhase outcome, int networkFailures, TimeSpan? retryAfter)
    {
        TimeSpan baseDelay = outcome switch
        {
            PaidActivationPhase.RateLimited => retryAfter ?? _timing.RateLimitDelay,
            PaidActivationPhase.NetworkUnavailable => TimeSpan.FromTicks(Math.Min(_timing.NetworkBackoffMax.Ticks,
                _timing.NetworkBackoffStart.Ticks << Math.Min(networkFailures - 1, 16))),
            _ => Attempts <= _timing.FirstIntervalChecks ? _timing.FirstInterval : _timing.SteadyInterval
        };
        // Retry-After is a floor; jitter only spreads clients that would otherwise check in lockstep.
        return baseDelay + TimeSpan.FromTicks((long)(_timing.Jitter.Ticks * Math.Clamp(_random(), 0, 1)));
    }

    public static PaidActivationPhase Classify(Exception ex, out TimeSpan? retryAfter)
    {
        retryAfter = null;
        switch (ex)
        {
            case EnrollmentRequiredException: return PaidActivationPhase.EnrollmentRequired;
            case V2ApiException api:
                retryAfter = api.RetryAfter;
                return api.Code switch
                {
                    "RATE_LIMITED" => PaidActivationPhase.RateLimited,
                    "PRODUCT_BLOCKED" => PaidActivationPhase.ProductBlocked,
                    "PRODUCT_NOT_AVAILABLE" => PaidActivationPhase.ProductUnavailable,
                    "ACCOUNT_RESTRICTED" => PaidActivationPhase.AccountRestricted,
                    "ENROLLMENT_REQUIRED" => PaidActivationPhase.EnrollmentRequired,
                    "LICENSE_REVOKED" => PaidActivationPhase.LicenseRevoked,
                    _ => PaidActivationPhase.NetworkUnavailable
                };
            // Transport, proxy pages, malformed or oversized responses and local lock contention are temporary.
            case HttpRequestException or IOException or JsonException or InvalidDataException or FormatException
                or UnauthorizedAccessException or TimeoutException:
            default:
                return PaidActivationPhase.NetworkUnavailable;
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            if (_disposed) return;
            _disposed = true; _generation++;
            _session?.Cancel(); _session?.Dispose(); _session = null; _wake = null;
        }
        Changed = null; Activated = null;
    }
}
