import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CapabilityId, configuration } from "../config";
import { ApiError } from "../common/errors";

const KEY = "yarizan:capabilities";

/**
 * The capabilities a route needs; all of them must be enabled. A class-level declaration applies to
 * every handler, and a handler-level declaration replaces it. A route with no declaration is refused.
 */
export const Capabilities = (...ids: [CapabilityId, ...CapabilityId[]]) =>
  SetMetadata(KEY, ids);

/** Service-level enforcement: sensitive services call this before any side effect. */
export function requireCapability(
  enabled: ReadonlySet<CapabilityId>,
  ...ids: CapabilityId[]
) {
  for (const id of ids)
    if (!enabled.has(id)) throw new ApiError("CAPABILITY_DISABLED", 503);
}

@Injectable()
export class CapabilityGuard implements CanActivate {
  private readonly enabled = configuration().enabledCapabilities;
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const ids = this.reflector.getAllAndOverride<CapabilityId[] | undefined>(
      KEY,
      [context.getHandler(), context.getClass()],
    );
    // Fail closed: a route that does not declare its capabilities is never served.
    if (!ids?.length) throw new ApiError("CAPABILITY_UNDECLARED", 503);
    requireCapability(this.enabled, ...ids);
    return true;
  }
}
