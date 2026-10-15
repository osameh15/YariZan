import "reflect-metadata";
import { Global, Module } from "@nestjs/common";
import { Database } from "./database/database";
import { Security } from "./security/security";
import { PasswordHashing } from "./security/passwords";
import { Audit } from "./audit/audit";
import { Outbox } from "./outbox/outbox";
import {
  Signing,
  SIGNING_KEY_MANAGER,
  DevelopmentKeyManager,
} from "./signing/signing";
import { Identity } from "./identity/identity";
import { Sms } from "./accounts/sms";
import { Otp } from "./accounts/otp";
import { AuthFlows } from "./accounts/auth-flows";
import { Accounts } from "./accounts/accounts";
import { Trials } from "./trials/trials";
import { Licenses } from "./licenses/licenses";
import { Activation } from "./activation/activation";
import { Notes } from "./admin/notes";
import { Admin } from "./admin/admin";
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
    Sms,
    Otp,
    AuthFlows,
    PasswordHashing,
    Audit,
    Outbox,
    Signing,
    {
      provide: SIGNING_KEY_MANAGER,
      useFactory: () => new DevelopmentKeyManager(),
    },
  ],
  exports: [
    Sms,
    Otp,
    AuthFlows,
    Database,
    Security,
    PasswordHashing,
    Audit,
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
  providers: [Admin, Notes],
  controllers: [AdminController],
})
class AdminModule {}
@Module({
  imports: [
    FoundationModule,
    IdentityModule,
    AccountsModule,
    DesktopModule,
    AdminModule,
  ],
  controllers: [HealthController, PublicController],
})
export class AppModule {}
