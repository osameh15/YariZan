#if NETFRAMEWORK
using System.Security.Cryptography;
using Org.BouncyCastle.Asn1;
using Org.BouncyCastle.Asn1.X509;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Digests;
using Org.BouncyCastle.Crypto.Engines;
using Org.BouncyCastle.Crypto.Modes;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Crypto.Signers;
using Org.BouncyCastle.OpenSsl;
using Org.BouncyCastle.Math;
using Org.BouncyCastle.Security;
using Org.BouncyCastle.X509;

namespace YariZan.Core.Legacy;

// Only the net48 build uses these adapters. Wire formats and primitives remain
// AES-GCM, PBKDF2-SHA256 and P-256/P1363; no legacy cipher or signature fallback.
public static class LegacyConvert
{
    public static string ToHexString(byte[] bytes) => BitConverter.ToString(bytes).Replace("-", "");
    public static byte[] FromHexString(string hex)
    {
        if (hex.Length % 2 != 0) throw new FormatException("Invalid hex length.");
        if (hex.Any(c => !(c is >= '0' and <= '9' or >= 'A' and <= 'F' or >= 'a' and <= 'f')))
            throw new FormatException("Invalid hex character.");
        var bytes = new byte[hex.Length / 2];
        for (int i = 0; i < bytes.Length; i++) bytes[i] = System.Convert.ToByte(hex.Substring(i * 2, 2), 16);
        return bytes;
    }
    public static string ToBase64String(byte[] bytes) => System.Convert.ToBase64String(bytes);
    public static byte[] FromBase64String(string value) => System.Convert.FromBase64String(value);
}

public static class LegacySha256
{
    public static byte[] HashData(byte[] data)
    { using var hash = System.Security.Cryptography.SHA256.Create(); return hash.ComputeHash(data); }
}
public static class LegacyHmacSha256
{
    public static byte[] HashData(byte[] key, byte[] data)
    { using var hash = new System.Security.Cryptography.HMACSHA256(key); return hash.ComputeHash(data); }
}
public static class LegacyRandom
{
    public static byte[] GetBytes(int length)
    {
        var bytes = new byte[length];
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        rng.GetBytes(bytes); return bytes;
    }
}
public static class LegacyPbkdf2
{
    public static byte[] Pbkdf2(byte[] password, byte[] salt, int iterations, HashAlgorithmName algorithm, int length)
    {
        if (algorithm != HashAlgorithmName.SHA256) throw new CryptographicException("SHA256 required.");
        using var derive = new System.Security.Cryptography.Rfc2898DeriveBytes(password, salt, iterations, algorithm);
        return derive.GetBytes(length);
    }
}
public static class LegacyCryptoOperations
{
    public static void ZeroMemory(Span<byte> bytes) => bytes.Clear();
    public static bool FixedTimeEquals(ReadOnlySpan<byte> left, ReadOnlySpan<byte> right)
    {
        if (left.Length != right.Length) return false;
        int difference = 0;
        for (int i = 0; i < left.Length; i++) difference |= left[i] ^ right[i];
        return difference == 0;
    }
}

public sealed class LegacyAesGcm : IDisposable
{
    private readonly byte[] _key;
    private bool _disposed;
    public LegacyAesGcm(byte[] key, int tagSize)
    {
        if (tagSize != 16 || key.Length is not (16 or 24 or 32)) throw new CryptographicException("Invalid AES-GCM parameters.");
        _key = (byte[])key.Clone();
    }
    public void Encrypt(ReadOnlySpan<byte> nonce, ReadOnlySpan<byte> plaintext, Span<byte> ciphertext, Span<byte> tag)
    {
        if (_disposed) throw new ObjectDisposedException(nameof(LegacyAesGcm));
        if (nonce.Length != 12 || tag.Length != 16 || plaintext.Length != ciphertext.Length) throw new CryptographicException("Invalid AES-GCM buffers.");
        var cipher = new GcmBlockCipher(new AesEngine());
        cipher.Init(true, new AeadParameters(new KeyParameter(_key), 128, nonce.ToArray()));
        var input = plaintext.ToArray(); var output = new byte[cipher.GetOutputSize(input.Length)];
        try
        {
            int count = cipher.ProcessBytes(input, 0, input.Length, output, 0);
            count += cipher.DoFinal(output, count);
            if (count != plaintext.Length + 16) throw new CryptographicException("Invalid AES-GCM output.");
            output.AsSpan(0, plaintext.Length).CopyTo(ciphertext);
            output.AsSpan(plaintext.Length, 16).CopyTo(tag);
        }
        finally { Array.Clear(input, 0, input.Length); Array.Clear(output, 0, output.Length); }
    }
    public void Decrypt(ReadOnlySpan<byte> nonce, ReadOnlySpan<byte> ciphertext, ReadOnlySpan<byte> tag, Span<byte> plaintext)
    {
        if (_disposed) throw new ObjectDisposedException(nameof(LegacyAesGcm));
        if (nonce.Length != 12 || tag.Length != 16 || ciphertext.Length != plaintext.Length) throw new CryptographicException("Invalid AES-GCM buffers.");
        var cipher = new GcmBlockCipher(new AesEngine());
        cipher.Init(false, new AeadParameters(new KeyParameter(_key), 128, nonce.ToArray()));
        var input = new byte[ciphertext.Length + 16];
        ciphertext.CopyTo(input.AsSpan()); tag.CopyTo(input.AsSpan(ciphertext.Length));
        var output = new byte[cipher.GetOutputSize(input.Length)];
        try
        {
            int count = cipher.ProcessBytes(input, 0, input.Length, output, 0);
            count += cipher.DoFinal(output, count); // authenticate BEFORE releasing any plaintext
            if (count != plaintext.Length) throw new CryptographicException("Invalid AES-GCM output.");
            output.AsSpan(0, count).CopyTo(plaintext);
        }
        catch (InvalidCipherTextException error)
        { plaintext.Clear(); throw new CryptographicException("AES-GCM authentication failed.", error); }
        finally { Array.Clear(input, 0, input.Length); Array.Clear(output, 0, output.Length); }
    }
    public void Dispose() { Array.Clear(_key, 0, _key.Length); _disposed = true; }
}

public enum LegacySignatureFormat { IeeeP1363FixedFieldConcatenation }

public sealed class LegacyEcdsa : IDisposable
{
    private ECPublicKeyParameters? _public;
    private ECPrivateKeyParameters? _private;
    public static LegacyEcdsa Create() => new();
    public int KeySize => 256;
    public void ImportFromPem(string pem)
    {
        _private = null;
        var reader = new PemReader(new StringReader(pem));
        object value = reader.ReadObject();
        if (reader.ReadObject() is not null) throw new CryptographicException("Expected one EC key.");
        if (value is AsymmetricCipherKeyPair pair) value = pair.Private;
        if (value is ECPrivateKeyParameters secret)
        { _private = secret; _public = new ECPublicKeyParameters(secret.Parameters.G.Multiply(secret.D), secret.Parameters); }
        else _public = value as ECPublicKeyParameters ?? throw new CryptographicException("EC key required.");
        var expected = Org.BouncyCastle.Asn1.Sec.SecNamedCurves.GetByName("secp256r1");
        if (!_public.Parameters.Curve.Equals(expected.Curve) || !_public.Parameters.G.Equals(expected.G)
            || !_public.Parameters.N.Equals(expected.N) || !_public.Parameters.H.Equals(expected.H))
            throw new CryptographicException("P-256 required.");
    }
    public void ImportSubjectPublicKeyInfo(byte[] bytes, out int read)
    {
        var info = SubjectPublicKeyInfo.GetInstance(Asn1Object.FromByteArray(bytes));
        if (info.Algorithm.Algorithm.Id != "1.2.840.10045.2.1"
            || info.Algorithm.Parameters is not DerObjectIdentifier curve || curve.Id != "1.2.840.10045.3.1.7")
            throw new CryptographicException("Named P-256 SPKI required.");
        _public = PublicKeyFactory.CreateKey(info) as ECPublicKeyParameters ?? throw new CryptographicException("EC public key required.");
        _private = null; read = bytes.Length;
    }
    public ECParameters ExportParameters(bool includePrivate)
    {
        var key = _public ?? throw new CryptographicException("Missing key.");
        var point = key.Q.Normalize();
        return new ECParameters { Curve = ECCurve.NamedCurves.nistP256,
            Q = new ECPoint { X = point.AffineXCoord.GetEncoded(), Y = point.AffineYCoord.GetEncoded() },
            D = includePrivate ? _private?.D.ToByteArrayUnsigned() : null };
    }
    public byte[] ExportSubjectPublicKeyInfo() => SubjectPublicKeyInfoFactory.CreateSubjectPublicKeyInfo(
        _public ?? throw new CryptographicException("Missing key.")).GetDerEncoded();
    public bool VerifyData(byte[] data, byte[] signature, HashAlgorithmName hash, LegacySignatureFormat format)
    {
        if (hash != HashAlgorithmName.SHA256 || format != LegacySignatureFormat.IeeeP1363FixedFieldConcatenation || signature.Length != 64) return false;
        var verifier = new ECDsaSigner(); verifier.Init(false, _public ?? throw new CryptographicException("Missing key."));
        return verifier.VerifySignature(LegacySha256.HashData(data), new BigInteger(1, signature.Take(32).ToArray()), new BigInteger(1, signature.Skip(32).ToArray()));
    }
    public byte[] SignData(byte[] data, HashAlgorithmName hash, LegacySignatureFormat format)
    {
        if (hash != HashAlgorithmName.SHA256 || format != LegacySignatureFormat.IeeeP1363FixedFieldConcatenation) throw new CryptographicException("ES256-P1363 required.");
        var signer = new ECDsaSigner(new HMacDsaKCalculator(new Sha256Digest()));
        signer.Init(true, _private ?? throw new CryptographicException("Missing private key."));
        var parts = signer.GenerateSignature(LegacySha256.HashData(data)); var output = new byte[64];
        for (int i = 0; i < 2; i++) { var bytes = parts[i].ToByteArrayUnsigned(); Buffer.BlockCopy(bytes, 0, output, i * 32 + 32 - bytes.Length, bytes.Length); }
        return output;
    }
    public void Dispose() { _private = null; _public = null; }
}
#endif
