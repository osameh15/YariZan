using System.Text.Json;
using var fixture=JsonDocument.Parse(File.ReadAllText(args[0]));
await ProvisioningTransportChecks.Run(fixture.RootElement);
