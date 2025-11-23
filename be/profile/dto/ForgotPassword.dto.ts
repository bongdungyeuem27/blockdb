import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.email().describe("Email"),
  otp: z.string().length(4).describe("OTP"),
  password: z.string().min(8).max(20).describe("Password"),
});

export class ForgotPasswordDTO extends createZodDto(forgotPasswordSchema) {}
