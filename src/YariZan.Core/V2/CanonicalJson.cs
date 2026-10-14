using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace YariZan.Core.V2;

public static class StrictJson
{
    public const int MaxBytes = 32768;
    public static JsonDocument Parse(string json)
    {
        if (Encoding.UTF8.GetByteCount(json) > MaxBytes) throw new InvalidDataException("Oversized JSON.");
        var document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 8 });
        try { _ = CanonicalJson.Serialize(document.RootElement); return document; }
        catch { document.Dispose(); throw; }
    }

    public static void Fields(JsonElement element, params string[] names)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal).SequenceEqual(names.Order(StringComparer.Ordinal)))
            throw new InvalidDataException("Unexpected or missing fields.");
    }
}

/// <summary>RFC 8785 on our bounded I-JSON subset: safe integers only, no floats.</summary>
public static class CanonicalJson
{
    public static string Serialize(JsonElement element)
    {
        var output = new StringBuilder();
        Write(element, output);
        return output.ToString();
    }

    private static void Write(JsonElement value, StringBuilder output)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.Object:
                var properties = value.EnumerateObject().ToArray();
                if (properties.Select(p => p.Name).Distinct(StringComparer.Ordinal).Count() != properties.Length)
                    throw new InvalidDataException("Duplicate JSON key.");
                output.Append('{');
                bool first = true;
                foreach (var property in properties.OrderBy(p => p.Name, StringComparer.Ordinal))
                {
                    if (!first) output.Append(','); first = false;
                    String(property.Name, output); output.Append(':'); Write(property.Value, output);
                }
                output.Append('}'); break;
            case JsonValueKind.Array:
                output.Append('['); first = true;
                foreach (var item in value.EnumerateArray())
                { if (!first) output.Append(','); first = false; Write(item, output); }
                output.Append(']'); break;
            case JsonValueKind.String: String(value.GetString()!, output); break;
            case JsonValueKind.Number:
                if (!value.TryGetInt64(out long number) || number is < -9007199254740991 or > 9007199254740991)
                    throw new InvalidDataException("Only safe integers are supported.");
                output.Append(number.ToString(CultureInfo.InvariantCulture)); break;
            case JsonValueKind.True: output.Append("true"); break;
            case JsonValueKind.False: output.Append("false"); break;
            case JsonValueKind.Null: output.Append("null"); break;
            default: throw new InvalidDataException("Invalid JSON value.");
        }
    }

    private static void String(string value, StringBuilder output)
    {
        output.Append('"');
        for (int i = 0; i < value.Length; i++)
        {
            char c = value[i];
            switch (c)
            {
                case '"': output.Append("\\\""); break;
                case '\\': output.Append("\\\\"); break;
                case '\b': output.Append("\\b"); break;
                case '\t': output.Append("\\t"); break;
                case '\n': output.Append("\\n"); break;
                case '\f': output.Append("\\f"); break;
                case '\r': output.Append("\\r"); break;
                default:
                    if (c < 32) output.Append("\\u").Append(((int)c).ToString("x4"));
                    else if (char.IsHighSurrogate(c))
                    {
                        if (i + 1 >= value.Length || !char.IsLowSurrogate(value[i + 1])) throw new InvalidDataException("Invalid Unicode.");
                        output.Append(c).Append(value[++i]);
                    }
                    else if (char.IsLowSurrogate(c)) throw new InvalidDataException("Invalid Unicode.");
                    else output.Append(c);
                    break;
            }
        }
        output.Append('"');
    }
}

public static class Base64Url
{
    public static string Encode(byte[] data) => Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    public static byte[] Decode(string value)
    {
        if (value.Length == 0 || value.Any(c => !(char.IsAsciiLetterOrDigit(c) || c is '-' or '_')))
            throw new InvalidDataException("Invalid base64url.");
        var bytes = Convert.FromBase64String(value.Replace('-', '+').Replace('_', '/') + new string('=', (4 - value.Length % 4) % 4));
        if (Encode(bytes) != value) throw new InvalidDataException("Noncanonical base64url.");
        return bytes;
    }
}
