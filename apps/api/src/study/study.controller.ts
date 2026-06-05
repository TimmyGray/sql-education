import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { RevealResult, SubmitResult } from "@sql-edu/contracts";
import { ActiveUserGuard, CurrentUser, JwtAuthGuard } from "../common";
import { SubmitAnswerDto } from "./dto/submit-answer.dto";
import { StudyService } from "./study.service";

/**
 * Study controller — write actions for the authenticated, ACTIVE user:
 * submitting answers and revealing reference solutions.
 */
@ApiTags("study")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard)
@Controller("study")
export class StudyController {
  constructor(private readonly study: StudyService) {}

  /**
   * Grade a submitted answer for a task and record progress.
   * 403 if the task's block is locked; 404 if the task doesn't exist.
   */
  @Post("tasks/:taskId/submit")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: "Grading result for the submitted answer." })
  submit(
    @CurrentUser("userId") userId: string,
    @Param("taskId") taskId: string,
    @Body() body: SubmitAnswerDto,
  ): Promise<SubmitResult> {
    return this.study.submit(userId, taskId, body.sql);
  }

  /**
   * Reveal a task's reference answer (sets the task SKIPPED unless already
   * COMPLETED). 403 if the task's block is locked; 404 if the task doesn't
   * exist.
   */
  @Post("tasks/:taskId/reveal")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: "The reference query and resulting status." })
  reveal(
    @CurrentUser("userId") userId: string,
    @Param("taskId") taskId: string,
  ): Promise<RevealResult> {
    return this.study.reveal(userId, taskId);
  }
}
