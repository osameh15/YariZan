#if NETFRAMEWORK
using System.Security.Cryptography;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.X509;

namespace YariZan.Core.Legacy
{
    public sealed class LegacyRandomSource
    {
        private readonly System.Random _random = new();
        public static LegacyRandomSource Shared { get; } = new();
        public double NextDouble() { lock (_random) return _random.NextDouble(); }
    }
    public sealed class LegacyCompletionSource(TaskCreationOptions options) : TaskCompletionSource<bool>(options)
    {
        public bool TrySetResult() => TrySetResult(true);
        public void SetResult() => SetResult(true);
    }
}

namespace System.IO
{
    public static class LegacyStreamExtensions
    {
        public static void Write(this Stream stream, byte[] bytes) => stream.Write(bytes, 0, bytes.Length);
        public static void ReadExactly(this Stream stream, byte[] bytes)
        {
            int offset = 0;
            while (offset < bytes.Length)
            {
                int read = stream.Read(bytes, offset, bytes.Length - offset);
                if (read == 0) throw new EndOfStreamException();
                offset += read;
            }
        }
    }
}

namespace System.Collections.Generic
{
    public static class LegacyDictionaryExtensions
    {
        public static TValue? GetValueOrDefault<TKey, TValue>(this IReadOnlyDictionary<TKey, TValue> dictionary, TKey key)
            => dictionary.TryGetValue(key, out var value) ? value : default;
    }
}

namespace System.Net.Http
{
    public static class LegacyHttpExtensions
    {
        public static async Task<IO.Stream> ReadAsStreamAsync(this HttpContent content, CancellationToken cancellation)
        {
            cancellation.ThrowIfCancellationRequested();
            using (cancellation.Register(content.Dispose))
            {
                try
                {
                    var stream = await content.ReadAsStreamAsync().ConfigureAwait(false);
                    cancellation.ThrowIfCancellationRequested();
                    return stream;
                }
                catch (Exception) when (cancellation.IsCancellationRequested) { throw new OperationCanceledException(cancellation); }
            }
        }
    }
}

namespace System.Diagnostics
{
    public static class LegacyProcessExtensions
    {
        public static void Kill(this Process process, bool entireProcessTree)
        {
            if (!entireProcessTree) { process.Kill(); return; }
            using var killer = Process.Start(new ProcessStartInfo
            {
                FileName = IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "taskkill.exe"),
                Arguments = "/PID " + process.Id.ToString(Globalization.CultureInfo.InvariantCulture) + " /T /F",
                UseShellExecute = false, CreateNoWindow = true
            }) ?? throw new InvalidOperationException("Could not stop game process tree.");
            killer.WaitForExit();
            if (killer.ExitCode != 0 && !process.HasExited) throw new InvalidOperationException("Could not stop game process tree.");
        }
        public static async Task WaitForExitAsync(this Process process, CancellationToken cancellation)
        {
            var exited = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
            EventHandler handler = (_, _) => exited.TrySetResult(true);
            process.Exited += handler;
            try
            {
                process.EnableRaisingEvents = true;
                using (cancellation.Register(() => exited.TrySetCanceled()))
                {
                    if (process.HasExited) exited.TrySetResult(true);
                    await exited.Task.ConfigureAwait(false);
                }
            }
            finally { process.Exited -= handler; }
        }
    }
}

namespace System.Security.Cryptography
{
    public static class LegacyCngExtensions
    {
        // Export ONLY the public coordinates. Persisted CNG private keys remain nonexportable.
        public static byte[] ExportSubjectPublicKeyInfo(this ECDsaCng key)
        {
            var p = key.ExportParameters(false);
            var curve = Org.BouncyCastle.Asn1.Sec.SecNamedCurves.GetByName("secp256r1");
            var domain = new ECNamedDomainParameters(new Org.BouncyCastle.Asn1.DerObjectIdentifier("1.2.840.10045.3.1.7"), curve);
            var point = curve.Curve.CreatePoint(new Org.BouncyCastle.Math.BigInteger(1, p.Q.X), new Org.BouncyCastle.Math.BigInteger(1, p.Q.Y));
            return SubjectPublicKeyInfoFactory.CreateSubjectPublicKeyInfo(new ECPublicKeyParameters(point, domain)).GetDerEncoded();
        }
        public static byte[] SignData(this ECDsaCng key, byte[] message, HashAlgorithmName hash, YariZan.Core.Legacy.LegacySignatureFormat format)
        {
            if (hash != HashAlgorithmName.SHA256 || format != YariZan.Core.Legacy.LegacySignatureFormat.IeeeP1363FixedFieldConcatenation)
                throw new CryptographicException("ES256-P1363 required.");
            var signature = key.SignData(message, hash);
            if (signature.Length != 64) throw new CryptographicException("Invalid P1363 signature.");
            return signature;
        }
    }
}
#endif
