import { createZodDto } from "nestjs-zod";
import { AskSchema } from "@sql-edu/contracts";

/**
 * Body DTO for `POST /ai/blocks/:blockId/ask`. Wraps the shared
 * {@link AskSchema} (`{ message: string }`) so Nest validates the request
 * against the contract via the global ZodValidationPipe.
 */
export class AskDto extends createZodDto(AskSchema) {}
