// profile.service.ts
import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuthService } from "src/auth/auth.service";
import { InjectDrizzle } from "src/infrastructure/database/bunsql.decorator";
import type { DrizzleDB } from "src/infrastructure/database/bunsql.interface";
import { profiles } from "src/schemas/profiles.schema";
import { TurnstileService } from "src/turnstile/turnstile.service";
import { MailService } from "../mail/mail.service";
import type { IAuthTokenResponseDTO } from "./dto/AuthToken.dto";
import type { EmailOTPDTO } from "./dto/EmailOTP.dto";
import type { ForgotPasswordDTO } from "./dto/ForgotPassword.dto";
import type { LoginDTO } from "./dto/Login.dto";
import type { SignupDTO, SignupGoogleDTO, SignupOtpDTO } from "./dto/Signup.dto";

@Injectable()
export class ProfileService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    @Inject(AuthService) private authService: AuthService,
    @Inject(MailService) private mailService: MailService,
    @Inject(TurnstileService) private turnstileService: TurnstileService,
  ) {}

  private generateOTP(length = 4): string {
    let otp = "";
    for (let i = 0; i < length; i++) {
      otp += Math.floor(Math.random() * 10).toString();
    }
    return otp;
  }

  private async getOrGenerateOTP(email: string) {
    const user = await this.db.query.profiles.findFirst({
      where: eq(profiles.email, email),
    });
    if (user && !user.isActive) {
      return Promise.reject({
        code: "BE::PROFILE::GET_OR_GENERATE_OTP::USER_NOT_ACTIVE",
      });
    }
    if (!user) {
      return Promise.reject({
        code: "BE::PROFILE::GET_OR_GENERATE_OTP::USER_NOT_FOUND",
      });
    }
    if (user.otp && user.otpExpiresAt && user.otpExpiresAt.getTime() > Date.now()) {
      return user.otp;
    }
    const newOtp = this.generateOTP();
    await this.db
      .update(profiles)
      .set({ otp: newOtp, otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000) })
      .where(eq(profiles.id, user.id));
    return newOtp;
  }

  private sendOTP(email: string, otp: string, lang: string) {
    this.mailService
      .sendTemplateEmail(
        email,
        lang === "en" ? "MayFest - New OTP Code" : "MayFest - Mã OTP mới",
        `signup_otp_${lang}`,
        {
          otp,
          support: {
            phone: process.env.INFO_PHONE,
            zalo: process.env.INFO_ZALO,
            email: process.env.INFO_SUPPORT_EMAIL,
          },
          lang,
          email: encodeURIComponent(email),
          website: process.env.INFO_WEBSITE,
        },
      )
      .catch((error) => {
        console.log(error);
      });
    return;
  }

  async signup(
    dto: SignupDTO,
  ): Promise<{ message?: string; code?: string; profile?: IAuthTokenResponseDTO }> {
    const existing = await this.db.query.profiles.findFirst({
      where: eq(profiles.email, dto.email),
    });

    if (existing) {
      if (!existing.isActive) {
        return Promise.reject({ code: "BE::PROFILE::SIGNUP::USER_NOT_ACTIVE" });
      }

      if (existing.isEmailVerified) {
        const isMatch = this.authService.verifyPassword(dto.password, existing.password);
        if (!isMatch) {
          return Promise.reject(
            new UnauthorizedException({
              code: "BE::PROFILE::SIGNUP::INVALID_CREDENTIALS",
            }),
          );
        }
        const tokens = await this.authService.generateTokens({
          id: existing.id,
          email: existing.email,
          fullName: existing.fullName,
          phone: existing.phone,
          gender: existing.gender,
          address: existing.address,
        });
        return {
          profile: {
            id: existing.id,
            email: existing.email,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            fullName: existing.fullName,
            phone: existing.phone,
            gender: existing.gender,
            address: existing.address,
          },
        };
      }

      if (existing.otpExpiresAt && existing.otpExpiresAt.getTime() > Date.now()) {
        return {
          code: "BE::PROFILE::SIGNUP::OTP_STILL_VALID",
        };
      }

      const otp = await this.getOrGenerateOTP(dto.email);
      this.sendOTP(dto.email, otp, dto.lang);

      return {
        message: "A new OTP has been sent to your email.",
        code: "BE::PROFILE::SIGNUP::NEW_OTP_SENT",
      };
    }

    if (this.authService.isSpamEmail(dto.email)) {
      return Promise.reject({ code: "BE::PROFILE::SIGNUP::SPAM_EMAIL" });
    }

    const passwordHash = await this.authService.hashPassword(dto.password!);
    const otp = this.generateOTP();
    await this.db.insert(profiles).values({
      email: dto.email,
      fullName: dto.fullName,
      phone: dto.phone,
      // gender: dto.gender,
      // address: dto.address,
      password: passwordHash,
      otp,
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      isEmailVerified: false,
    });

    this.sendOTP(dto.email, otp, dto.lang);

    return { message: "OTP sent to email", code: "BE::PROFILE::SIGNUP::OTP_SENT" };
  }

  async signupGoogle(dto: SignupGoogleDTO): Promise<IAuthTokenResponseDTO | { message: string }> {
    const googleProfile = await this.authService.getTokenInfo(dto.googleAccessToken);

    const existing = await this.db.query.profiles.findFirst({
      where: eq(profiles.email, googleProfile.email!),
    });

    if (existing && !existing.isActive) {
      return Promise.reject({ code: "BE::PROFILE::SIGNUP_GOOGLE::USER_NOT_ACTIVE" });
    }

    if (existing) {
      if (!existing.isEmailVerified) {
        await this.db
          .update(profiles)
          .set({
            isEmailVerified: true,
          })
          .where(eq(profiles.id, existing.id));
      }
      const tokens = await this.authService.generateTokens({
        id: existing.id,
        email: existing.email,
        fullName: existing.fullName,
        phone: existing.phone,
        gender: existing.gender,
        address: existing.address,
      });
      return {
        id: existing.id,
        email: existing.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        fullName: existing.fullName,
        phone: existing.phone,
        gender: existing.gender,
        address: existing.address,
      };
    }

    const created = await this.db
      .insert(profiles)
      .values({
        email: googleProfile.email!,
        isEmailVerified: true,
      })
      .returning()
      .then(([profile]) => profile);
    const tokens = await this.authService.generateTokens({
      id: created.id,
      email: created.email,
      fullName: created.fullName,
      phone: created.phone,
      gender: created.gender,
      address: created.address,
    });
    return {
      id: created.id,
      email: created.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      fullName: created.fullName,
      phone: created.phone,
      gender: created.gender,
      address: created.address,
    };
  }

  async verifyOtp(dto: SignupOtpDTO): Promise<IAuthTokenResponseDTO> {
    const user = await this.db.query.profiles.findFirst({
      where: and(eq(profiles.email, dto.email)),
    });
    if (user && !user.isActive) {
      return Promise.reject({ code: "BE::PROFILE::VERIFY_OTP::USER_NOT_ACTIVE" });
    }
    if (!user || user.otp !== dto.otp) {
      return Promise.reject(
        new BadRequestException({
          code: "BE::PROFILE::VERIFY_OTP::INVALID_OTP",
        }),
      );
    }
    if (!user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      return Promise.reject(
        new BadRequestException({ code: "BE::PROFILE::VERIFY_OTP::OTP_EXPIRED" }),
      );
    }
    await this.db
      .update(profiles)
      .set({
        isEmailVerified: true,
        otp: undefined,
        otpExpiresAt: undefined,
      })
      .where(eq(profiles.id, user.id));

    const tokens = await this.authService.generateTokens({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      gender: user.gender,
      address: user.address,
    });
    return {
      id: user.id,
      email: user.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      fullName: user.fullName,
      phone: user.phone,
      gender: user.gender,
      address: user.address,
    };
  }

  async login(dto: LoginDTO): Promise<IAuthTokenResponseDTO> {
    const user = await this.db.query.profiles.findFirst({
      where: and(eq(profiles.email, dto.email)),
    });
    if (user && !user.isActive) {
      return Promise.reject({ code: "BE::PROFILE::LOGIN::USER_NOT_ACTIVE" });
    }
    if (!user || !user.password) {
      return Promise.reject(
        new BadRequestException({ code: "BE::PROFILE::LOGIN::INVALID_CREDENTIALS" }),
      );
    }
    if (!user.isEmailVerified) {
      return Promise.reject(
        new BadRequestException({ code: "BE::PROFILE::LOGIN::EMAIL_NOT_VERIFIED" }),
      );
    }
    const isMatch = this.authService.verifyPassword(dto.password, user.password);
    if (!isMatch) {
      return Promise.reject(
        new BadRequestException({ code: "BE::PROFILE::LOGIN::INVALID_CREDENTIALS" }),
      );
    }
    const tokens = await this.authService.generateTokens({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      gender: user.gender,
      address: user.address,
    });
    return {
      id: user.id,
      email: user.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      fullName: user.fullName,
      phone: user.phone,
      gender: user.gender,
      address: user.address,
    };
  }

  async renewToken(refreshToken: string): Promise<IAuthTokenResponseDTO> {
    const payload = await this.authService.verifyRefreshToken(refreshToken);
    if (!payload) {
      return Promise.reject(
        new BadRequestException({
          code: "BE::PROFILE::RENEW_TOKEN::INVALID_REFRESH_TOKEN",
        }),
      );
    }

    const tokens = await this.authService.generateTokens({
      id: payload.id,
      email: payload.email,
      fullName: payload.fullName,
      phone: payload.phone,
      gender: payload.gender,
      address: payload.address,
    });

    return {
      id: payload.id,
      email: payload.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      fullName: payload.fullName,
      phone: payload.phone,
      gender: payload.gender,
      address: payload.address,
    };
  }

  async autoLogin(refreshToken: string) {
    const tokens = await this.renewToken(refreshToken);
    return tokens;
  }

  async getEmailOTP(dto: EmailOTPDTO) {
    await this.turnstileService.verify(dto.captchaToken);

    const otp = await this.getOrGenerateOTP(dto.email);
    this.sendOTP(dto.email, otp, dto.lang);
    return {
      message: "OTP sent to email",
      code: "BE::PROFILE::GET_EMAIL_OTP::OTP_SENT",
    };
  }

  async forgotPassword(dto: ForgotPasswordDTO) {
    const user = await this.db.query.profiles.findFirst({
      where: and(eq(profiles.email, dto.email)),
    });
    if (user && !user.isActive) {
      return Promise.reject({ code: "BE::PROFILE::FORGOT_PASSWORD::USER_NOT_ACTIVE" });
    }
    if (!user) {
      return Promise.reject({ code: "BE::PROFILE::FORGOT_PASSWORD::USER_NOT_FOUND" });
    }
    if (!user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      return Promise.reject({ code: "BE::PROFILE::FORGOT_PASSWORD::OTP_EXPIRED" });
    }
    if (user.otp !== dto.otp) {
      return Promise.reject({ code: "BE::PROFILE::FORGOT_PASSWORD::INVALID_OTP" });
    }
    const passwordHash = await this.authService.hashPassword(dto.password);
    await this.db
      .update(profiles)
      .set({
        password: passwordHash,
        otp: undefined,
        otpExpiresAt: undefined,
        isEmailVerified: true,
      })
      .where(eq(profiles.id, user.id));
    const tokens = await this.authService.generateTokens({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      gender: user.gender,
      address: user.address,
    });
    return {
      id: user.id,
      email: user.email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      fullName: user.fullName,
      phone: user.phone,
      gender: user.gender,
      address: user.address,
    };
  }

  testMail() {
    this.mailService.sendMail("khanhlemaiduy123@gmail.com", "Test Mail", "This is a test mail");
  }
}
