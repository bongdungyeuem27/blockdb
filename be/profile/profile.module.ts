import { Module } from "@nestjs/common";
import { AuthService } from "src/auth/auth.service";
import { MailService } from "src/mail/mail.service";
import { TurnstileService } from "src/turnstile/turnstile.service";
import { ProfileService } from "./profile.service";

@Module({
  imports: [],
  controllers: [],
  providers: [ProfileService, AuthService, TurnstileService, MailService],
  exports: [ProfileService],
})
export class ProfileModule {}
