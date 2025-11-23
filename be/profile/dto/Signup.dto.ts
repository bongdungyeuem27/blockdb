import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const signupSchema = z.object({
  email: z.email().describe("Email"),
  password: z.string().min(8).max(20).describe("Password"),
  fullName: z.string().min(1).max(255).describe("Full Name"),
  phone: z.string().min(10).max(20).describe("Phone"),
  lang: z.enum(["en", "vi"]).default("vi").describe("Lang"),
});

export class SignupDTO extends createZodDto(signupSchema) {}

export const signupGoogleSchema = z.object({
  googleAccessToken: z.string().describe("Google Access Token"),
});

export class SignupGoogleDTO extends createZodDto(signupGoogleSchema) {}

export const signupOtpSchema = z.object({
  email: z.string().email().describe("Email"),
  otp: z.string().min(4).max(4).describe("OTP"),
});

export class SignupOtpDTO extends createZodDto(signupOtpSchema) {}
