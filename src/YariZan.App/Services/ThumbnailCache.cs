using System.IO;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace YariZan.App.Services;

// Called on the UI thread; only decoding runs on workers. Bound both RAM and disk work.
internal sealed class ThumbnailCache
{
    private readonly Dictionary<string, Task<ImageSource?>> _cache = new();
    private readonly Queue<string> _order = new();
    private readonly SemaphoreSlim _decoders = new(2);

    public Task<ImageSource?> GetAsync(string relative)
    {
        if (string.IsNullOrEmpty(relative)) return Task.FromResult<ImageSource?>(null);
        if (_cache.TryGetValue(relative, out var existing)) return existing;
        var task = DecodeAsync(AppPaths.ResolveGameFile(relative));
        _cache.Add(relative, task);
        _order.Enqueue(relative);
        while (_order.Count > 48) _cache.Remove(_order.Dequeue());
        return task;
    }

    private async Task<ImageSource?> DecodeAsync(string path)
    {
        await _decoders.WaitAsync().ConfigureAwait(false);
        try
        {
            return await Task.Run<ImageSource?>(() =>
            {
                try
                {
                    using var stream = File.OpenRead(path);
                    var bitmap = new BitmapImage();
                    bitmap.BeginInit();
                    bitmap.CacheOption = BitmapCacheOption.OnLoad;
                    bitmap.DecodePixelHeight = 360;
                    bitmap.StreamSource = stream;
                    bitmap.EndInit();
                    bitmap.Freeze();
                    return bitmap;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException
                    or NotSupportedException or ArgumentException or System.IO.FileFormatException)
                {
                    return null;
                }
            }).ConfigureAwait(false);
        }
        finally { _decoders.Release(); }
    }
}
