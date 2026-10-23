import "reflect-metadata";
import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CapabilityGuard } from "./security/capabilities";
import { Database } from "./database/database";
import { Security } from "./security/security";
import { Abuse } from "./security/abuse";
import { PasswordHashing } from "./security/passwords";
import { Audit } from "./audit/audit";
import { Orders } from "./commerce/orders";
import { Gateway } from "./commerce/gateway";
import { Payments } from "./commerce/payments";
import { Promotions } from "./commerce/promotions";
import { CommerceAdministration } from "./commerce/administration";
import { CommerceController } from "./commerce/controller";
import { PaymentReadiness } from "./commerce/readiness";
import { Outbox } from "./outbox/outbox";
import {
  Signing,
  SIGNING_KEY_MANAGER,
  signingKeyManager,
} from "./signing/signing";
import { Identity } from "./identity/identity";
import { Sms } from "./accounts/sms";
import { Notifications } from "./accounts/notifications";
import { Otp } from "./accounts/otp";
import { AuthFlows } from "./accounts/auth-flows";
import { Accounts } from "./accounts/accounts";
import { Trials } from "./trials/trials";
import { Licenses } from "./licenses/licenses";
import { Activation } from "./activation/activation";
import { Notes } from "./admin/notes";
import { Admin } from "./admin/admin";
import { AdminEnrollment } from "./admin/enrollment";
import {
  AccountsController,
  AdminController,
  DesktopController,
  HealthController,
  IdentityController,
  PublicController,
} from "./api/controllers";

@Global()
@Module({
  providers: [
    Database,
    Security,
    Abuse,
    Sms,
    Notifications,
    Otp,
    AuthFlows,
    PasswordHashing,
    Audit,
    Promotions,
    Outbox,
    Signing,
    {
      provide: SIGNING_KEY_MANAGER,
      useFactory: () => signingKeyManager(),
    },
  ],
  exports: [
    Sms,
    Notifications,
    Otp,
    AuthFlows,
    Database,
    Security,
    Abuse,
    PasswordHashing,
    Audit,
    Promotions,
    Outbox,
    Signing,
  ],
})
class FoundationModule {}
@Module({ providers: [Identity], controllers: [IdentityController] })
class IdentityModule {}
@Module({
  providers: [Accounts],
  exports: [Accounts],
  controllers: [AccountsController],
})
class AccountsModule {}
@Module({ providers: [Licenses], exports: [Licenses] })
class LicensesModule {}
@Module({
  imports: [LicensesModule],
  providers: [Activation],
  exports: [Activation],
})
class ActivationModule {}
@Module({
  imports: [LicensesModule, ActivationModule],
  providers: [Trials],
  controllers: [DesktopController],
})
class DesktopModule {}
@Module({
  imports: [LicensesModule, ActivationModule, AccountsModule],
  providers: [Admin, Notes, AdminEnrollment],
  exports: [Admin, AdminEnrollment],
  controllers: [AdminController],
})
class AdminModule {}
@Module({
  imports: [LicensesModule, AdminModule],
  providers: [
    Gateway,
    Orders,
    Payments,
    CommerceAdministration,
    PaymentReadiness,
  ],
  controllers: [CommerceController],
})
class CommerceModule {}
@Module({
  imports: [
    FoundationModule,
    IdentityModule,
    AccountsModule,
    DesktopModule,
    AdminModule,
    CommerceModule,
  ],
  controllers: [HealthController, PublicController],
  // Every route declares its capabilities; undeclared or disabled ones are refused.
  providers: [{ provide: APP_GUARD, useClass: CapabilityGuard }],
})
export class AppModule {}
