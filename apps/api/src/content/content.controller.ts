import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { BlockContent, Dashboard } from "@sql-edu/contracts";
import { ActiveUserGuard, CurrentUser, JwtAuthGuard } from "../common";
import { ContentService } from "./content.service";

/**
 * Content controller — read-only study content for the authenticated, ACTIVE
 * user. All routes require a valid access token AND an activated account.
 */
@ApiTags("content")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveUserGuard)
@Controller("content")
export class ContentController {
  constructor(private readonly content: ContentService) {}

  /** Per-user dashboard: XP + ordered block summaries for every level. */
  @Get("dashboard")
  @ApiOkResponse({ description: "Per-user dashboard across all levels." })
  getDashboard(@CurrentUser("userId") userId: string): Promise<Dashboard> {
    return this.content.getDashboard(userId);
  }

  /**
   * Full content for a single block (theory + public tasks + AI quota).
   * Returns 403 if the block is LOCKED for this user, 404 if it doesn't exist.
   */
  @Get("blocks/:blockId")
  @ApiOkResponse({ description: "Full block content for studying." })
  getBlock(
    @CurrentUser("userId") userId: string,
    @Param("blockId") blockId: string,
  ): Promise<BlockContent> {
    return this.content.getBlockContent(userId, blockId);
  }
}
