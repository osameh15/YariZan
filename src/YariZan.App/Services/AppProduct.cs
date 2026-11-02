using System.Reflection;
using YariZan.Core;
using YariZan.Core.V2;

namespace YariZan.App.Services;

public static class AppProduct
{
    // The executable fixes a standalone SKU at build time. Editable bundle metadata can
    // describe the game but can never select which paid license the application accepts.
    public static Product Resolve(GameManifest manifest)
    {
        var sku = typeof(AppProduct).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
            .SingleOrDefault(attribute => attribute.Key == "YariZanStandaloneProduct")?.Value;
        return sku is null ? new Product(manifest.SelectedGrade) : new Product(sku);
    }
}
