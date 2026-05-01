using System.Text.Json;
using System.Text.Json.Serialization;

namespace YariZan.Core;

public sealed class GameManifest
{
    public int Version { get; set; } = 1;
    public List<GradeEntry> Grades { get; set; } = new();
}

public sealed class GradeEntry
{
    public int Grade { get; set; }
    public List<GameEntry> Games { get; set; } = new();
}

public sealed class GameEntry
{
    public string Name { get; set; } = "";
    public string EncryptedFile { get; set; } = "";
    public string ImageFile { get; set; } = "";
    public string Description { get; set; } = "";
    public int Grade { get; set; }
}

public static class GameManifestIo
{
    private static readonly JsonSerializerOptions Opts = new()
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingDefault,
    };

    public static void Write(GameManifest m, string path) =>
        File.WriteAllText(path, JsonSerializer.Serialize(m, Opts));

    public static GameManifest Read(string path) =>
        JsonSerializer.Deserialize<GameManifest>(File.ReadAllText(path), Opts)
            ?? throw new InvalidDataException("Bad manifest.");
}
