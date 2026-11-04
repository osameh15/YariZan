namespace YariZan.Core.V2;

/// <summary>One reviewed independent game: identity, source folder and published names.</summary>
/// <param name="Slug">Website path segment, packer argument and download namespace.</param>
/// <param name="Sku">Full license identity; never a grade SKU.</param>
/// <param name="Title">Persian title shown in the app and installer.</param>
/// <param name="SourceFolder">Folder under miniApps/ holding exactly one game executable.</param>
/// <param name="FileStem">File name stem of the launchers and installer.</param>
/// <param name="EnglishName">Install folder and version-info product name.</param>
public sealed record StandaloneProduct(string Slug, string Sku, string Title, string SourceFolder, string FileStem, string EnglishName)
{
    public string StorePath => "/special-products/" + Slug;
}

/// <summary>The independent games this source tree can pack, build and sell.</summary>
public static class StandaloneCatalog
{
    public static IReadOnlyList<StandaloneProduct> All { get; } =
    [
        new("number-builder", "YARIZAN-S-NUMBER-BUILDER", "عددساز کوچولو", "عددساز کوچولو", "YariZan-NumberBuilder", "YariZan Number Builder"),
        new("bundle-builder", "YARIZAN-S-BUNDLE-BUILDER", "دسته‌ساز کوچک", "دسته ساز کوچک", "YariZan-BundleBuilder", "YariZan Bundle Builder"),
    ];

    public static StandaloneProduct? BySlug(string slug) => All.FirstOrDefault(p => p.Slug == slug);
    public static StandaloneProduct? BySku(string sku) => All.FirstOrDefault(p => p.Sku == sku);
}
