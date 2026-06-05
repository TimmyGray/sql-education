import { createZodDto } from "nestjs-zod";
import { SubmitAnswerSchema } from "@sql-edu/contracts";

/**
 * Body DTO for `POST /study/tasks/:taskId/submit`. Wraps the shared
 * {@link SubmitAnswerSchema} (`{ sql: string }`) so Nest validates the request
 * against the contract via the global ZodValidationPipe.
 */
export class SubmitAnswerDto extends createZodDto(SubmitAnswerSchema) {}
