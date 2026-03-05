import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_AUTH_LOGIN_PATH: z.string().default("/login"),
  NEXT_PUBLIC_AUTH_HOME_PATH: z.string().default("/"),
});

export const env = clientEnvSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_AUTH_LOGIN_PATH: process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH,
  NEXT_PUBLIC_AUTH_HOME_PATH: process.env.NEXT_PUBLIC_AUTH_HOME_PATH,
});
