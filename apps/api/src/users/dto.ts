import { createZodDto } from "nestjs-zod";
import { UpdateProfileSchema } from "@sql-edu/contracts";

/**
 * Profile-update DTO. Wraps the shared `UpdateProfileSchema`
 * (`{ displayName?: string(1..60) }`); validated by the global ZodValidationPipe.
 */
export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
