import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { FastifyReply } from "fastify";
import { OAuth2Client } from "google-auth-library";
import type { IAuthTokenResponseDTO } from "src/profile/dto/AuthToken.dto";
import { AuthRole } from "./auth.types";

const spamDomains = await Bun.file("spam.json").json();

@Injectable()
export class AuthService {
  private oauth2Client: OAuth2Client;

  constructor(@Inject(JwtService) private jwtService: JwtService) {
    this.oauth2Client = new OAuth2Client(
      process.env.OAUTH_CLIENT_ID,
      process.env.OAUTH_CLIENT_SECRET,
      process.env.OAUTH_REDIRECT_URI,
    );
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.userId };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  isSpamEmail(email: string): boolean {
    // Regex tách name và domain
    const emailRegex = /^([^@]+)@([^@]+)$/;
    const match = email.match(emailRegex);

    if (!match) return false; // không phải email hợp lệ

    const localPart = match[1]; // phần trước @
    const domainPart = match[2].toLowerCase(); // phần sau @

    // 1. Kiểm tra domain nằm trong danh sách spam
    const isSpamDomain = spamDomains.some((spamDomain) => domainPart === spamDomain.toLowerCase());

    // 2. Kiểm tra có dạng +number (myname+1, myname+123, ...)
    const hasPlusNumber = /\+\d+$/.test(localPart);

    return isSpamDomain || hasPlusNumber;
  }

  validateUser(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      return null;
    }
  }

  signToken(payload: { id: string; email: string }) {
    return this.jwtService.sign(payload);
  }

  async hashPassword(password: string) {
    return await Bun.password.hash(password);
  }

  async verifyPassword(password: string | null, hash: string | null) {
    if (!password || !hash) {
      return false;
    }
    return await Bun.password.verify(password, hash);
  }

  async getTokenInfo(accessToken: string) {
    const tokenInfo = await this.oauth2Client.getTokenInfo(accessToken);
    return tokenInfo;
  }

  async generateTokens(
    payload: {
      id: string;
      email: string;
      fullName: string | null;
      phone: string | null;
      gender: string | null;
      address: string | null;
    },
    role: AuthRole = AuthRole.USER,
  ) {
    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(
        {
          ...payload,
          role,
        },
        {
          expiresIn: "15m",
        },
      ),
      this.jwtService.signAsync(
        {
          ...payload,
          role,
        },
        {
          expiresIn: "7d",
          secret: process.env.JWT_REFRESH_SECRET,
        },
      ),
    ]);

    return {
      access_token,
      refresh_token,
    };
  }

  async verifyRefreshToken(token: string) {
    return this.jwtService
      .verifyAsync<{
        id: string;
        email: string;
        exp: number;
        iat: number;
        fullName: string | null;
        phone: string | null;
        gender: string | null;
        address: string | null;
      }>(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      })
      .catch((e) => {
        console.log(e);
        return e;
      });
  }

  attachRefreshToken(reply: FastifyReply, tokens: IAuthTokenResponseDTO) {
    reply.setCookie("refresh_token", tokens.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // @ts-ignore
    tokens.refresh_token = undefined;
    return tokens;
  }
}
