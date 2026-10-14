using System.Security.Cryptography;

namespace YariZan.Core.V2;

public enum DesktopAccessState
{
    NoLicense, Purchased, Revoked, TrialAvailable, TrialStarted, TrialExhausted,
    ConnectionUnavailable, ActivationPending, InvalidLicense, EnrollmentRequired, Closed
}

public interface ITrialStartClient
{
    Task<int> GetTrialStatusAsync(Product product, CancellationToken cancellation);
    Task<TrialStartResponse> StartTrialAsync(TrialStartRequest request, CancellationToken cancellation);
}
public interface ILicenseSyncService
{
    Task<string> SynchronizeAsync(PaidLicense license, CancellationToken cancellation);
    Task<string> PickupAsync(Product product, CancellationToken cancellation);
}
public interface IDesktopV2Client : ITrialStartClient, ILicenseSyncService
{
    string? DeviceId { get; }
}
public interface IAccessPolicy
{
    DesktopAccessState State { get; }
    bool CanEnter { get; }
    bool IsPurchased { get; }
}
public sealed class EnrollmentRequiredException : Exception;
public sealed class TrialExhaustedException : Exception;

/// <summary>One instance owned by the application process; network never participates in CanEnter.</summary>
public sealed class DesktopAccessController : IAccessPolicy, IDisposable
{
    private readonly IDeviceIdentity _device;
    private readonly Product _product;
    private readonly ILicenseVerifier _verifier;
    private readonly ILicenseStore _store;
    private readonly IDesktopV2Client _client;
    private readonly SemaphoreSlim _operation = new(1, 1);
    private readonly CancellationTokenSource _lifetime = new();
    private readonly string _processId = Guid.NewGuid().ToString("D");
    private readonly string _nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private bool _closed;
    private PaidLicense? _license;
    public string Username => _device.Username;
    public DesktopAccessState State { get; private set; } = DesktopAccessState.NoLicense;
    public DesktopAccessState LocalLicenseState { get; private set; } = DesktopAccessState.NoLicense;
    public string? LastError { get; private set; }
    public int? TrialRemaining { get; private set; }
    public bool IsPurchased => !_closed && State == DesktopAccessState.Purchased;
    public bool CanEnter => !_closed && State is DesktopAccessState.Purchased or DesktopAccessState.TrialStarted;

    public DesktopAccessController(IDeviceIdentity device, Product product, ILicenseVerifier verifier,
        ILicenseStore store, IDesktopV2Client client)
    {
        _device = device; _product = product; _verifier = verifier; _store = store; _client = client;
        ReadLocalAccess();
    }

    private void ReadLocalAccess()
    {
        try
        {
            var saved = _store.ReadLicense(_product);
            if (saved.Status == StoreReadStatus.Missing) return;
            if (saved.Status != StoreReadStatus.Present) throw new InvalidDataException("Corrupt license storage.");
            _license = _verifier.VerifyLicense(saved.Envelope!, _device, _product);
            var decision = _store.ReadDecision(_product);
            if (decision.Status == StoreReadStatus.Corrupt) throw new InvalidDataException("Corrupt decision storage.");
            State = DesktopAccessState.Purchased;
            if (decision.Status == StoreReadStatus.Present)
            {
                // Reissue across license IDs requires an authenticated recovery contract (Phase 2).
                var oldId = DecisionLicenseId(decision.Envelope!);
                if (oldId == _license.LicenseId && _verifier.VerifyDecision(decision.Envelope!, _license).Status == "REVOKED")
                    State = DesktopAccessState.Revoked;
                else if (oldId == _license.LicenseId) _verifier.VerifyDecision(decision.Envelope!, _license);
                else throw new InvalidDataException("License recovery requires authenticated decision replacement.");
            }
        }
        catch (Exception ex) when (IsSafeFailure(ex)) { State = DesktopAccessState.InvalidLicense; LastError = "INVALID_LOCAL_ARTIFACT"; }
        LocalLicenseState = State;
    }

    private static string? DecisionLicenseId(string envelope)
    { using var d = StrictJson.Parse(envelope); return d.RootElement.GetProperty("payload").GetProperty("license_id").GetString(); }

    public async Task RefreshTrialStatusAsync(CancellationToken cancellation = default)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, _lifetime.Token);
        await _operation.WaitAsync(linked.Token);
        try
        {
            if (CanEnter || _closed) return;
            int remaining = await _client.GetTrialStatusAsync(_product, linked.Token);
            linked.Token.ThrowIfCancellationRequested();
            if (remaining is < 0 or > 2) throw new InvalidDataException("Invalid trial count.");
            TrialRemaining = remaining;
            State = remaining > 0 ? DesktopAccessState.TrialAvailable : DesktopAccessState.TrialExhausted;
            LastError = null;
        }
        catch (TrialExhaustedException) { if (!_closed) { State = DesktopAccessState.TrialExhausted; TrialRemaining = 0; } }
        catch (EnrollmentRequiredException) { if (!_closed) { State = DesktopAccessState.EnrollmentRequired; LastError = "ENROLLMENT_REQUIRED"; } }
        catch (Exception ex) when (IsSafeFailure(ex)) { if (!_closed) { State = DesktopAccessState.ConnectionUnavailable; LastError = "STATUS_UNAVAILABLE"; } }
        finally { _operation.Release(); }
    }

    public async Task StartTrialAsync(CancellationToken cancellation = default)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, _lifetime.Token);
        await _operation.WaitAsync(linked.Token);
        try
        {
            if (CanEnter) return;
            linked.Token.ThrowIfCancellationRequested();
            if (!_device.IsAvailable || _client.DeviceId is not { } deviceId) throw new EnrollmentRequiredException();
            var request = new TrialStartRequest(deviceId, _product.Sku, _nonce, _processId);
            var response = await _client.StartTrialAsync(request, linked.Token);
            linked.Token.ThrowIfCancellationRequested();
            if (response.Remaining is < 0 or > 1) throw new InvalidDataException("Invalid trial remaining count.");
            SignedArtifactVerifier.Timestamp(response.ServerTime);
            _verifier.VerifyTrial(response.Grant, request, _product);
            TrialRemaining = response.Remaining;
            State = DesktopAccessState.TrialStarted; LastError = null;
            // No grant file, clock, timer, renewal, game authorization or deferred trial network operation.
        }
        catch (TrialExhaustedException) { if (!_closed) { State = DesktopAccessState.TrialExhausted; TrialRemaining = 0; } throw; }
        catch (EnrollmentRequiredException) { if (!_closed) State = DesktopAccessState.EnrollmentRequired; throw; }
        catch (Exception ex) when (IsSafeFailure(ex)) { if (!_closed) { State = DesktopAccessState.ConnectionUnavailable; LastError = "TRIAL_START_FAILED"; } throw; }
        finally { _operation.Release(); }
    }

    public async Task PickupLicenseAsync(CancellationToken cancellation = default)
    {
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, _lifetime.Token);
        await _operation.WaitAsync(linked.Token);
        var previous = State;
        try
        {
            linked.Token.ThrowIfCancellationRequested();
            if (IsPurchased) return;
            State = DesktopAccessState.ActivationPending;
            if (LocalLicenseState == DesktopAccessState.Revoked && _license is { } revokedLicense)
            {
                string recovery = await _client.SynchronizeAsync(revokedLicense, linked.Token);
                linked.Token.ThrowIfCancellationRequested();
                var decision = _verifier.VerifyDecision(recovery, revokedLicense);
                if (decision.Status != "ACTIVE" || !PersistDecision(revokedLicense, recovery, decision))
                    throw new InvalidDataException("No newer authenticated recovery decision.");
                State = LocalLicenseState = DesktopAccessState.Purchased; LastError = null;
                return;
            }
            string envelope = await _client.PickupAsync(_product, linked.Token);
            linked.Token.ThrowIfCancellationRequested();
            var license = _verifier.VerifyLicense(envelope, _device, _product);
            if (_client.DeviceId != license.DeviceId) throw new InvalidDataException("Pickup device ID mismatch.");
            using (_store.AcquireWriteLock(_product))
            {
                var savedDecision = _store.ReadDecision(_product);
                // Recovery/reissue must deliver a reviewed authenticated replacement contract in Phase 2.
                if (savedDecision.Status != StoreReadStatus.Missing)
                {
                    if (savedDecision.Status != StoreReadStatus.Present || _verifier.VerifyDecision(savedDecision.Envelope!, license).Status == "REVOKED")
                        throw new InvalidDataException("License has a local revocation or recovery conflict.");
                }
                _store.WriteLicense(_product, envelope);
            }
            _license = license; State = LocalLicenseState = DesktopAccessState.Purchased; LastError = null;
        }
        catch { if (!_closed) State = previous; throw; }
        finally { _operation.Release(); }
    }

    public Task SynchronizePurchasedAsync(CancellationToken cancellation = default)
    {
        // Schedule the whole operation so even a synchronous client cannot delay local entry.
        var license = IsPurchased ? _license : null;
        return license is null ? Task.CompletedTask : Task.Run(async () =>
        {
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellation, _lifetime.Token);
            try
            {
                string envelope = await _client.SynchronizeAsync(license, linked.Token);
                linked.Token.ThrowIfCancellationRequested();
                var decision = _verifier.VerifyDecision(envelope, license);
                PersistDecision(license, envelope, decision);
                // Freeze access for the current process. Only a new controller reads the learned decision.
            }
            catch (Exception ex) when (IsSafeFailure(ex) || ex is EnrollmentRequiredException)
            { LastError = "SYNC_UNAVAILABLE_OR_INVALID"; }
        });
    }

    private bool PersistDecision(PaidLicense license, string envelope, LicenseDecision decision)
    {
        using (_store.AcquireWriteLock(_product))
        {
            var currentLicense = _store.ReadLicense(_product);
            if (currentLicense.Status != StoreReadStatus.Present || _verifier.VerifyLicense(currentLicense.Envelope!, _device, _product).LicenseId != license.LicenseId) return false;
            var saved = _store.ReadDecision(_product);
            if (saved.Status == StoreReadStatus.Corrupt) throw new InvalidDataException("Corrupt decision.");
            if (saved.Status == StoreReadStatus.Present && _verifier.VerifyDecision(saved.Envelope!, license).Version >= decision.Version) return false;
            _store.WriteDecision(_product, envelope);
            return true;
        }
    }

    private static bool IsSafeFailure(Exception ex) => ex is IOException or InvalidDataException or System.Text.Json.JsonException
        or CryptographicException or FormatException or InvalidOperationException or ArgumentException
        or UnauthorizedAccessException or HttpRequestException or OperationCanceledException or V2ApiException or KeyNotFoundException;

    public void Dispose()
    { _closed = true; State = DesktopAccessState.Closed; TrialRemaining = null; _license = null; _lifetime.Cancel(); }
}
