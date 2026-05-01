using System.Reflection;
using System.Text;

namespace YariZan.Core;

public static class AppKeys
{
    public static string LoadEmbeddedPublicKeyPem()
    {
        using var s = OpenResource("public.pem");
        using var r = new StreamReader(s, Encoding.UTF8);
        return r.ReadToEnd();
    }

    public static byte[] LoadEmbeddedMasterKey()
    {
        using var s = OpenResource("master.key");
        using var ms = new MemoryStream();
        s.CopyTo(ms);
        return ms.ToArray();
    }

    private static Stream OpenResource(string fileName)
    {
        var asm = Assembly.GetEntryAssembly() ?? Assembly.GetExecutingAssembly();
        var name = asm.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("." + fileName, StringComparison.OrdinalIgnoreCase))
            ?? throw new FileNotFoundException(
                $"Embedded resource {fileName} not found. Make sure secrets/{fileName} is generated and embedded.");
        return asm.GetManifestResourceStream(name)!;
    }
}
