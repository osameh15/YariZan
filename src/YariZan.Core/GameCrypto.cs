using System.Security.Cryptography;

namespace YariZan.Core;

public static class GameCrypto
{
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private const int ChunkSize = 1 << 20;

    public static void Encrypt(byte[] masterKey, string sourcePath, string destPath)
    {
        var plain = File.ReadAllBytes(sourcePath);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var cipher = new byte[plain.Length];
        var tag = new byte[TagSize];
        using (var aes = new AesGcm(masterKey, TagSize))
            aes.Encrypt(nonce, plain, cipher, tag);
        using var fs = File.Create(destPath);
        fs.Write(System.Text.Encoding.ASCII.GetBytes("YZG1"));
        fs.Write(nonce);
        fs.Write(tag);
        fs.Write(cipher);
    }

    public static byte[] Decrypt(byte[] masterKey, string encryptedPath)
    {
        var blob = File.ReadAllBytes(encryptedPath);
        if (blob.Length < 4 + NonceSize + TagSize ||
            blob[0] != 'Y' || blob[1] != 'Z' || blob[2] != 'G' || blob[3] != '1')
            throw new InvalidDataException("Invalid game blob.");
        var nonce = blob.AsSpan(4, NonceSize);
        var tag = blob.AsSpan(4 + NonceSize, TagSize);
        var cipher = blob.AsSpan(4 + NonceSize + TagSize);
        var plain = new byte[cipher.Length];
        using var aes = new AesGcm(masterKey, TagSize);
        aes.Decrypt(nonce, cipher, tag, plain);
        return plain;
    }
}
