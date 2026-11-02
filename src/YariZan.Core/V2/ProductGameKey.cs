using System.Security.Cryptography;
using System.Text;

namespace YariZan.Core.V2;

/// <summary>Independent game ciphertext is bound to its full product identity, not a grade's game key.</summary>
public static class ProductGameKey
{
    public static byte[] Derive(byte[] masterKey, Product product)
    {
        if (masterKey.Length != 32 || !product.IsStandalone)
            throw new ArgumentException("A standalone product and a 256-bit master key are required.");
        return HMACSHA256.HashData(masterKey, Encoding.UTF8.GetBytes("YariZan-Standalone-Game-Key-V1\n" + product.Sku));
    }
}
