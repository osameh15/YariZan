namespace YariZan.Core;

/// <summary>One trial entry authorizes this process until it closes.</summary>
public sealed class AccessSession
{
    private readonly Func<bool> _isActivated;
    private readonly Func<Task<int>> _recordTrial;
    private readonly SemaphoreSlim _trialLock = new(1, 1);
    private bool _trialStarted;
    public int? TrialRemaining { get; private set; }

    public AccessSession(Func<bool> isActivated, Action recordTrial)
    {
        _isActivated = isActivated;
        _recordTrial = () => { recordTrial(); return Task.FromResult(-1); };
    }

    public AccessSession(Func<bool> isActivated, Func<Task<int>> recordTrial)
    {
        _isActivated = isActivated;
        _recordTrial = recordTrial;
    }

    public bool CanEnter => _isActivated() || _trialStarted;

    public void StartTrial() => StartTrialAsync().GetAwaiter().GetResult();

    public async Task StartTrialAsync()
    {
        await _trialLock.WaitAsync();
        try
        {
            if (_trialStarted || _isActivated()) return;
            int remaining = await _recordTrial();
            TrialRemaining = remaining >= 0 ? remaining : null;
            _trialStarted = true;
        }
        finally { _trialLock.Release(); }
    }
}
