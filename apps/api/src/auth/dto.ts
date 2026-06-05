import { createZodDto } from "nestjs-zod";
import {
  ActivateSchema,
  LoginSchema,
  RegisterSchema,
  ResendCodeSchema,
} from "@sql-edu/contracts";

/**
 * Request DTOs for the auth controller. Each wraps a shared Zod contract via
 * `createZodDto`; the global `ZodValidationPipe` (registered in main.ts)
 * validates incoming bodies against these automatically.
 *
 * `RegisterSchema` is a refined schema (password === confirmPassword); nestjs-zod
 * supports refinements, so the cross-field check runs as part of validation.
 */
export class RegisterDto extends createZodDto(RegisterSchema) {}
export class ActivateDto extends createZodDto(ActivateSchema) {}
export class LoginDto extends createZodDto(LoginSchema) {}
export class ResendCodeDto extends createZodDto(ResendCodeSchema) {}
