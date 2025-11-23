import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().describe("Email"),
  password: z.string().describe("Password"),
});

export class LoginDTO extends createZodDto(loginSchema) {}
