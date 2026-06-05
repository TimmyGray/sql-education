import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: { status: { type: "string", example: "ok" } },
    },
  })
  check(): { status: "ok" } {
    return { status: "ok" };
  }
}
