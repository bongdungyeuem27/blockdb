import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const emailOTPSchema = z.object({
  email: z.email().describe("Email"),
  lang: z.enum(["en", "vi"]).default("vi").describe("Lang"),
  captchaToken: z.string().describe("Turnstile Token"),
});

export class EmailOTPDTO extends createZodDto(emailOTPSchema) {}
