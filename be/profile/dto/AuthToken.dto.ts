import { z } from "zod";

export const authTokenResponseSchema = z.object({
  id: z.string().describe("ID"),
  email: z.string().describe("Email"),
  access_token: z.string().describe("Access Token"),
  refresh_token: z.string().describe("Refresh Token"),
  fullName: z.string().nullable().describe("Full Name"),
  phone: z.string().nullable().describe("Phone"),
  gender: z.string().nullable().describe("Gender"),
  address: z.string().nullable().describe("Address"),
});

export type IAuthTokenResponseDTO = z.infer<typeof authTokenResponseSchema>;
