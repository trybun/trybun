import { Controller, Get, Query } from '@nestjs/common';
import {
  type ListProjectMemberAccountsQuery,
  listProjectMemberAccountsQuerySchema,
  type ProjectMemberAccountPage,
  projectMemberAccountPageSchema,
} from '@trybun/contracts/projects';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { ProjectsService } from './projects.service.js';

/**
 * The members of several projects at once (§7.5): one request for the Assignee picker of the
 * ticket list filters and the names of its chosen values (§8.1), whatever the number of projects.
 */
@Controller('project-members')
export class ProjectMembersController {
  constructor(private readonly projects: ProjectsService) {}

  /** The distinct team accounts with a team role in the projects whose members one may read. */
  @Get()
  @ResponseSchema(projectMemberAccountPageSchema)
  list(
    @CurrentPrincipal() principal: Principal,
    @Query({ schema: listProjectMemberAccountsQuerySchema }) query: ListProjectMemberAccountsQuery,
  ): Promise<ProjectMemberAccountPage> {
    return this.projects.listMemberAccounts(principal, query);
  }
}
