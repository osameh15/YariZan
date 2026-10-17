using System.IO;
using System.Net;
using System.Net.Http;
using YariZan.Core.V2;

/// <summary>Deterministic virtual time: delays complete at once and advance the clock they report.</summary>
internal sealed class VirtualTime
{
    public DateTimeOffset Now = new(2026, 10, 17, 12, 0, 0, TimeSpan.Zero);
    public readonly List<TimeSpan> Delays = new();
    public Action<int>? OnDelay;
    public Task Delay(TimeSpan delay, CancellationToken cancellation)
    {
        Delays.Add(delay); Now += delay;
        OnDelay?.Invoke(Delays.Count);
        cancellation.ThrowIfCancellationRequested();
        return Task.CompletedTask;
    }
}

internal static partial class Program
{
    private static PaidActivationCoordinator Coordinator(DesktopAccessController access, VirtualTime time, IActivationIntentStore? intent = null,
        PaidActivationTiming? timing = null) =>
        new(access, intent ?? new MemoryActivationIntentStore(), timing ?? PaidActivationTiming.Default, time.Delay, () => 0, () => time.Now);

    private static void AutoActivationChecks(SigningFixture signing, IDeviceIdentity identity)
    {
        // 1-2. Enrolled, no purchase yet: waiting; purchase verified after a delay: automatic pickup and storage.
        {
            var server = new FakeServer(signing, identity); var store = Store("auto-delayed-purchase");
            using var access = Access(identity, signing, store, server);
            var time = new VirtualTime(); var intent = new MemoryActivationIntentStore();
            using var activation = Coordinator(access, time, intent);
            int activated = 0; var phases = new List<PaidActivationPhase>();
            activation.Activated += (_, _) => activated++;
            activation.Changed += (_, _) => phases.Add(activation.Phase);
            time.OnDelay = n => { if (n == 3) server.EntitlementState = "ACTIVE"; };
            Check(activation.CanCheckOnline && !access.CanEnter, "enrolled unpaid device may check online and stays locked");
            var run = activation.StartWaitingAsync();
            Check(intent.IsPending(G1) || activation.Phase == PaidActivationPhase.Activated, "customer wait is remembered while pending");
            Run(run);
            Check(access.IsPurchased && activated == 1 && server.PickupRequests == 1 && server.EntitlementRequests == 4,
                "purchase verified after three waiting checks is picked up automatically exactly once");
            Check(store.ReadLicense(G1).Status == StoreReadStatus.Present && !intent.IsPending(G1),
                "activated license is durably stored and the wait marker cleared");
            Check(phases.Contains(PaidActivationPhase.WaitingForPurchase) && phases.Contains(PaidActivationPhase.RetrievingLicense)
                && phases[^1] == PaidActivationPhase.Activated, "waiting, retrieving and activated phases are reported in order");
            Check(time.Delays.SequenceEqual(Enumerable.Repeat(TimeSpan.FromSeconds(10), 3)), "default waiting interval is 10 seconds with zero jitter sample");
            server.Offline = true;
            using var restart = Access(identity, signing, store, server);
            Check(restart.IsPurchased, "automatically activated license starts offline after restart");
        }

        // 3. Payment pending for several polls: no false unlock, no pickup, bounded and cancellable.
        {
            var server = new FakeServer(signing, identity);
            using var access = Access(identity, signing, Store("auto-pending"), server);
            var time = new VirtualTime(); var intent = new MemoryActivationIntentStore();
            using var activation = Coordinator(access, time, intent);
            time.OnDelay = n => { if (n == 8) activation.Stop(clearIntent: true); };
            Run(activation.StartWaitingAsync());
            Check(!access.CanEnter && server.PickupRequests == 0 && server.EntitlementRequests == 8 && activation.Phase == PaidActivationPhase.Cancelled,
                "eight pending-payment checks never unlock and never request pickup");
            Check(time.Delays.Take(6).All(d => d == TimeSpan.FromSeconds(10)) && time.Delays.Skip(6).All(d => d == TimeSpan.FromSeconds(15)),
                "interval backs off from 10 to 15 seconds after six checks");
            Check(!intent.IsPending(G1) && !activation.IsRunning, "explicit cancel stops polling and clears the wait marker");
            var capped = new VirtualTime();
            using var limited = Coordinator(access, capped, timing: PaidActivationTiming.Default with { MaxWait = TimeSpan.FromMinutes(2) });
            Run(limited.StartWaitingAsync());
            Check(limited.Phase == PaidActivationPhase.Paused && !limited.IsRunning && capped.Delays.Count < 12 && !access.CanEnter,
                "automatic waiting pauses after its time budget instead of polling indefinitely");
        }

        // 4. Fulfillment delayed after verified payment: pickup races fulfillment, then succeeds.
        {
            var server = new FakeServer(signing, identity) { EntitlementState = "ACTIVE" };
            server.PickupFailures.Enqueue(new V2ApiException("ENTITLEMENT_REQUIRED", HttpStatusCode.Forbidden));
            server.PickupFailures.Enqueue(new V2ApiException("ENTITLEMENT_REQUIRED", HttpStatusCode.Forbidden));
            using var access = Access(identity, signing, Store("auto-fulfillment-race"), server);
            var time = new VirtualTime();
            using var activation = Coordinator(access, time);
            Run(activation.StartWaitingAsync());
            Check(access.IsPurchased && server.PickupRequests == 3 && time.Delays.Count == 2,
                "pickup that races fulfillment keeps waiting and activates once the signed license exists");
        }

        // 10. Network timeout and transport failure while waiting: recoverable, never a revocation.
        {
            var server = new FakeServer(signing, identity) { PendingEntitlements = new(TaskCreationOptions.RunContinuationsAsynchronously) };
            using var access = Access(identity, signing, Store("auto-timeout"), server);
            using var activation = new PaidActivationCoordinator(access, new MemoryActivationIntentStore(),
                PaidActivationTiming.Default with { AttemptDeadline = TimeSpan.FromMilliseconds(150), StartupDeadline = TimeSpan.FromMilliseconds(150) });
            Run(activation.StartStartupRecoveryAsync());
            Check(activation.Phase == PaidActivationPhase.NetworkUnavailable && !activation.IsRunning && access.LocalLicenseState == DesktopAccessState.NoLicense,
                "hung entitlement request hits the per-request deadline and stays a recoverable network state");
            server.PendingEntitlements = null; server.Offline = true;
            var time = new VirtualTime();
            using var waiting = Coordinator(access, time);
            time.OnDelay = n => { if (n == 4) { server.Offline = false; server.EntitlementState = "ACTIVE"; } };
            Run(waiting.StartWaitingAsync());
            Check(access.IsPurchased && time.Delays.Take(4).SequenceEqual(new[] { 10, 20, 40, 60 }.Select(s => TimeSpan.FromSeconds(s))),
                "disconnected transport backs off 10/20/40/60 seconds and recovers to activation");
            var limitedServer = new FakeServer(signing, identity) { EntitlementState = "ACTIVE" };
            limitedServer.EntitlementFailures.Enqueue(new V2ApiException("RATE_LIMITED", (HttpStatusCode)429, TimeSpan.FromSeconds(90)));
            using var limitedAccess = Access(identity, signing, Store("auto-rate-limit"), limitedServer);
            var limitedTime = new VirtualTime();
            using var limited = Coordinator(limitedAccess, limitedTime);
            Run(limited.StartWaitingAsync());
            Check(limitedAccess.IsPurchased && limitedTime.Delays.First() == TimeSpan.FromSeconds(90), "429 Retry-After is respected before the next check");
            var paidStore = Store("auto-network-preserves"); paidStore.WriteLicense(G1, signing.License(identity));
            using var paid = Access(identity, signing, paidStore, new FakeServer(signing, identity) { Offline = true });
            using var paidActivation = Coordinator(paid, new VirtualTime());
            Check(paid.IsPurchased && !paidActivation.CanCheckOnline && paidActivation.StartStartupRecoveryAsync().IsCompleted && paid.IsPurchased,
                "network outage never invalidates a stored paid license and needs no polling");
        }

        // 11-12, 20. Invalid signature, wrong device, wrong grade and unsigned success bodies never unlock.
        {
            using var wrongSigner = new SigningFixture();
            var foreign = signing.LicensePayload(identity); foreign["device_id"] = SigningFixture.CustomerId;
            var responses = new Dictionary<string, string>
            {
                ["invalid signature"] = wrongSigner.License(identity),
                ["tampered payload"] = signing.License(identity).Replace("\"license_revision\":1", "\"license_revision\":2"),
                ["wrong grade"] = signing.License(identity, 2),
                ["wrong device"] = signing.Sign(foreign, SignedArtifactVerifier.LicenseDomain),
                ["unsigned purchase success"] = "{\"status\":\"PAID\",\"sku\":\"YARIZAN-G1\"}",
            };
            foreach (var (name, body) in responses)
            {
                var server = new FakeServer(signing, identity) { EntitlementState = "ACTIVE", PickupResponse = body };
                var store = Store("auto-invalid-" + name.Replace(' ', '-'));
                using var access = Access(identity, signing, store, server);
                var time = new VirtualTime(); var intent = new MemoryActivationIntentStore();
                using var activation = Coordinator(access, time, intent);
                Run(activation.StartWaitingAsync());
                Check(!access.CanEnter && activation.Phase == PaidActivationPhase.InvalidLicense && !activation.IsRunning
                    && store.ReadLicense(G1).Status == StoreReadStatus.Missing && time.Delays.Count == 0 && !intent.IsPending(G1),
                    "automatic pickup refuses and stops on " + name);
            }
            var pendingServer = new FakeServer(signing, identity) { EntitlementState = "ACTIVE", PendingPickup = new(TaskCreationOptions.RunContinuationsAsynchronously) };
            using var pendingAccess = Access(identity, signing, Store("auto-entitlement-not-access"), pendingServer);
            using var pending = Coordinator(pendingAccess, new VirtualTime());
            var running = pending.StartWaitingAsync();
            Check(!pendingAccess.CanEnter && pending.Phase == PaidActivationPhase.RetrievingLicense, "ACTIVE entitlement row alone grants nothing before a signed license verifies");
            pendingServer.PendingPickup.SetResult(signing.License(identity)); Run(running);
            Check(pendingAccess.IsPurchased, "verified pickup after the entitlement row activates");
        }

        // 13. Cached signed revocation keeps next-launch enforcement; server revocation stops waiting.
        {
            var store = Store("auto-revoked"); store.WriteLicense(G1, signing.License(identity)); store.WriteDecision(G1, signing.Decision(identity, 5));
            var server = new FakeServer(signing, identity) { EntitlementState = "ACTIVE" };
            using var revoked = Access(identity, signing, store, server);
            using var activation = Coordinator(revoked, new VirtualTime());
            Run(activation.StartStartupRecoveryAsync()); Run(activation.StartWaitingAsync());
            Check(revoked.State == DesktopAccessState.Revoked && !revoked.CanEnter && server.EntitlementRequests == 0 && server.PickupRequests == 0
                && Run(revoked.CheckPurchasedLicenseAsync()) == PaidCheckOutcome.LicenseRevoked,
                "cached signed revocation is enforced at launch and automatic activation cannot bypass it");
            foreach (var (label, configure) in new (string, Action<FakeServer>)[]
            {
                ("revoked entitlement", s => s.EntitlementState = "REVOKED"),
                ("revoked pickup", s => { s.EntitlementState = "ACTIVE"; s.PickupFailures.Enqueue(new V2ApiException("LICENSE_REVOKED", HttpStatusCode.Forbidden)); }),
                ("blocked product", s => s.EntitlementFailures.Enqueue(new V2ApiException("PRODUCT_BLOCKED", HttpStatusCode.Forbidden))),
                ("restricted account", s => s.EntitlementFailures.Enqueue(new V2ApiException("ACCOUNT_RESTRICTED", HttpStatusCode.Forbidden))),
            })
            {
                var denied = new FakeServer(signing, identity); configure(denied);
                using var access = Access(identity, signing, Store("auto-denied-" + label.Replace(' ', '-')), denied);
                var time = new VirtualTime();
                using var waiting = Coordinator(access, time);
                Run(waiting.StartWaitingAsync());
                Check(!access.CanEnter && !waiting.IsRunning && time.Delays.Count == 0 && waiting.Phase != PaidActivationPhase.NetworkUnavailable,
                    "automatic waiting stops without retrying on " + label);
            }
        }

        // 14-15. Duplicate and out-of-order triggers: one session, one request at a time, one transition.
        {
            var server = new FakeServer(signing, identity) { PendingEntitlements = new(TaskCreationOptions.RunContinuationsAsynchronously) };
            using var access = Access(identity, signing, Store("auto-duplicates"), server);
            using var activation = Coordinator(access, new VirtualTime());
            int activated = 0; activation.Activated += (_, _) => activated++;
            var first = activation.StartWaitingAsync(); var second = activation.StartWaitingAsync();
            var third = activation.CheckNowAsync(); var startup = activation.StartStartupRecoveryAsync();
            Check(ReferenceEquals(first, second) && ReferenceEquals(first, third) && ReferenceEquals(first, startup) && server.EntitlementRequests == 1,
                "repeated activate, check-now and startup triggers join one in-flight session");
            var direct = access.CheckPurchasedLicenseAsync();
            server.PendingEntitlements.SetResult("ACTIVE"); Run(first); Run(direct);
            Check(access.IsPurchased && activated == 1 && server.PickupRequests == 1, "concurrent checks serialize and pick up exactly once");
            Run(activation.StartWaitingAsync());
            Check(activated == 1 && server.EntitlementRequests == 1, "a late trigger after activation performs no request and no second transition");

            var staleServer = new FakeServer(signing, identity) { PendingEntitlements = new(TaskCreationOptions.RunContinuationsAsynchronously) };
            using var staleAccess = Access(identity, signing, Store("auto-stale"), staleServer);
            using var stale = Coordinator(staleAccess, new VirtualTime());
            int changes = 0; stale.Changed += (_, _) => changes++;
            var abandoned = stale.StartWaitingAsync(); stale.Stop(clearIntent: false);
            int afterStop = changes;
            staleServer.PendingEntitlements.SetResult("ACTIVE"); Run(abandoned);
            Check(!staleAccess.CanEnter && changes == afterStop && staleServer.PickupRequests == 0,
                "a response arriving after the wait stopped causes no state change and no pickup");
        }

        // 16-17. Trial is separate: waiting never spends trials, never suspends a running trial, never persists it.
        {
            var server = new FakeServer(signing, identity);
            var store = Store("auto-trial");
            using var access = Access(identity, signing, store, server);
            var time = new VirtualTime();
            using var activation = Coordinator(access, time);
            time.OnDelay = n => { if (n == 3) activation.Stop(clearIntent: false); };
            Run(activation.StartWaitingAsync());
            Check(server.Used() == 0 && server.StartRequests == 0 && server.StatusRequests == 0, "payment waiting never starts or spends a trial");
            Run(access.StartTrialAsync());
            server.EntitlementState = "ACTIVE"; server.PendingPickup = new(TaskCreationOptions.RunContinuationsAsynchronously);
            using var upgrade = Coordinator(access, new VirtualTime());
            var pending = upgrade.StartWaitingAsync();
            Check(access.CanEnter && access.State == DesktopAccessState.TrialStarted, "pending paid pickup keeps current-process trial access");
            server.PendingPickup.SetException(new HttpRequestException("simulated disconnect"));
            Run(pending);
            Check(upgrade.Phase == PaidActivationPhase.Paused && access.CanEnter && access.State == DesktopAccessState.TrialStarted && server.Used() == 1, "failed paid check leaves the started trial intact");
            Check(store.ReadLicense(G1).Status == StoreReadStatus.Missing, "a current-process trial is never written as a license");
            server.PendingPickup = null;
            using var completing = Coordinator(access, new VirtualTime());
            Run(completing.StartWaitingAsync());
            Check(access.IsPurchased && server.Used() == 1, "trial-to-paid upgrade activates without consuming another trial");
            Run(access.RefreshTrialStatusAsync());
            Check(access.IsPurchased, "a later trial status refresh cannot overwrite paid activation");
            var trialOnly = Store("auto-trial-only");
            using (var trialAccess = Access(identity, signing, trialOnly, new FakeServer(signing, identity))) Run(trialAccess.StartTrialAsync());
            using (var restart = Access(identity, signing, trialOnly, new FakeServer(signing, identity) { Offline = true }))
                Check(!restart.CanEnter && trialOnly.ReadLicense(G1).Status == StoreReadStatus.Missing, "trial access never becomes a perpetual license after restart");
        }

        // 18. A different Windows profile without its own enrollment is never checked online (simulated profile).
        {
            var server = new FakeServer(signing, identity) { EntitlementState = "ACTIVE" };
            using var otherProfile = new DesktopAccessController(identity, G1, signing.Verifier, Store("auto-other-profile"), server, new UnprovisionedDeviceEnrollment());
            using var activation = Coordinator(otherProfile, new VirtualTime());
            Run(activation.StartStartupRecoveryAsync());
            Check(!activation.CanCheckOnline && !otherProfile.CanEnter && server.EntitlementRequests == 0 && server.PickupRequests == 0,
                "unenrolled profile makes no automatic request and keeps its own enrollment requirement");
            Run(activation.StartWaitingAsync());
            Check(activation.Phase == PaidActivationPhase.EnrollmentRequired && !otherProfile.CanEnter && server.PickupRequests == 0,
                "explicit wait on an unenrolled profile reports enrollment required");
        }

        // Wait marker: a UX hint only, bounded lifetime, never access.
        {
            var time = new VirtualTime(); string root = Path.Combine(_root, "auto-intent");
            var intent = new FileActivationIntentStore(root, () => time.Now);
            intent.MarkPending(G1);
            Check(intent.IsPending(G1) && !intent.IsPending(new Product(2)), "wait marker is per grade");
            using (var access = Access(identity, signing, Store("auto-intent-store"), new FakeServer(signing, identity) { Offline = true }))
                Check(!access.CanEnter, "a wait marker never grants access");
            time.Now += TimeSpan.FromDays(8);
            Check(!intent.IsPending(G1) && !File.Exists(Path.Combine(root, "YARIZAN-G1.awaiting-purchase")), "expired wait marker is ignored and removed");
            File.WriteAllText(Path.Combine(root, "YARIZAN-G1.awaiting-purchase"), "not-a-date");
            Check(!intent.IsPending(G1), "malformed wait marker is ignored");
        }

        // 19. Actual DPAPI storage written by automatic pickup survives into a separate OS process, offline.
        {
            var store = Store("auto-dpapi");
            var server = new FakeServer(signing, identity) { EntitlementState = "ACTIVE" };
            using (var access = Access(identity, signing, store, server))
            using (var activation = Coordinator(access, new VirtualTime())) Run(activation.StartStartupRecoveryAsync());
            string keys = Path.Combine(_root, "public-keys.json");
            Check(ChildSucceeds("--child-paid", Path.Combine(_root, "auto-dpapi"), keys), "auto-activated DPAPI license accepted by a new OS process fully offline");
        }
    }

    private static void AutoActivationTransportChecks(SigningFixture signing, IDeviceIdentity identity)
    {
        var server = new FakeServer(signing, identity);
        using var http = new HttpClient(new ContractHandler(server));
        var client = new DesktopV2Client(http, new Credentials());
        Check(Run(client.GetEntitlementsAsync(default)).Count == 0, "HTTP entitlement lookup parses an empty list");
        server.EntitlementState = "ACTIVE";
        var rows = Run(client.GetEntitlementsAsync(default));
        Check(rows.Single() == new DesktopEntitlement("YARIZAN-G1", "ACTIVE"), "HTTP entitlement lookup parses sku and state");
        using var access = Access(identity, signing, Store("auto-http"), client);
        using var activation = Coordinator(access, new VirtualTime());
        Run(activation.StartWaitingAsync());
        Check(access.IsPurchased && server.PickupRequests == 1, "HTTP entitlement lookup then signed pickup activates through the real client");
        server.EntitlementFailures.Enqueue(new V2ApiException("RATE_LIMITED", (HttpStatusCode)429, TimeSpan.FromSeconds(42)));
        var limited = Reject(() => Run(client.GetEntitlementsAsync(default)));
        Check(limited, "HTTP 429 entitlement lookup is rejected");
        server.EntitlementFailures.Enqueue(new V2ApiException("RATE_LIMITED", (HttpStatusCode)429, TimeSpan.FromSeconds(42)));
        try { Run(client.GetEntitlementsAsync(default)); }
        catch (V2ApiException ex) { Check(ex.Code == "RATE_LIMITED" && ex.RetryAfter == TimeSpan.FromSeconds(42), "Retry-After header is parsed into the API error"); }
        foreach (string body in new[] { "{}", "[{\"sku\":\"YARIZAN-G9\",\"state\":\"ACTIVE\"}]", "[{\"sku\":\"YARIZAN-G1\",\"state\":\"PAID\"}]",
            "[{\"sku\":\"YARIZAN-G1\",\"state\":\"ACTIVE\",\"order\":\"x\"}]", "<html>captive portal</html>" })
        {
            using var raw = new HttpClient(new Handler { Body = body });
            var strict = new DesktopV2Client(raw, new Credentials());
            Check(Reject(() => Run(strict.GetEntitlementsAsync(default))), "malformed entitlement response rejected: " + body[..Math.Min(body.Length, 24)]);
            Check(PaidActivationCoordinator.Classify(new InvalidDataException(), out _) == PaidActivationPhase.NetworkUnavailable,
                "malformed transport body is treated as temporary, not as revocation");
        }
    }
}
