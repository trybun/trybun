import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import {
  type AddProjectMemberDto,
  addProjectMemberSchema,
  type ChangeProjectMemberRoleDto,
  changeProjectMemberRoleSchema,
  type CreateProjectDto,
  createProjectSchema,
  type ListMemberCandidatesQuery,
  listMemberCandidatesQuerySchema,
  type ListProjectMembersQuery,
  listProjectMembersQuerySchema,
  type ListProjectsQuery,
  listProjectsQuerySchema,
  type MemberCandidatePage,
  memberCandidatePageSchema,
  type Project,
  type ProjectMember,
  type ProjectMemberPage,
  projectMemberPageSchema,
  type ProjectMemberParams,
  projectMemberParamsSchema,
  projectMemberSchema,
  type ProjectPage,
  projectPageSchema,
  type ProjectParams,
  projectParamsSchema,
  projectSchema,
  type UpdateProjectDto,
  updateProjectSchema,
} from '@trybun/contracts/projects';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { TargetRecord } from '../../platform/authorization/target-record.decorator.js';
import { ExpectedVersion } from '../../platform/http/expected-version.decorator.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { PROJECT } from './projects.abilities.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /** The projects in one state the principal can see (§7.3). */
  @Get()
  @ResponseSchema(projectPageSchema)
  list(
    @CurrentPrincipal() principal: Principal,
    @Query({ schema: listProjectsQuerySchema }) query: ListProjectsQuery,
  ): Promise<ProjectPage> {
    return this.projects.list(principal, query);
  }

  /** Creates a project (§3.1); the Administrator only. */
  @Post()
  @ResponseSchema(projectSchema, HttpStatus.CREATED)
  create(
    @CurrentPrincipal() principal: Principal,
    @Body({ schema: createProjectSchema }) input: CreateProjectDto,
  ): Promise<Project> {
    return this.projects.create(principal, input);
  }

  @Get(':projectId')
  @TargetRecord({ subject: PROJECT, param: 'projectId', action: 'read' })
  @ResponseSchema(projectSchema)
  findOne(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: projectParamsSchema }) { projectId }: ProjectParams,
  ): Promise<Project> {
    return this.projects.findOne(principal, projectId);
  }

  /** Changes the name and the key, or the settings; the service checks each field (§18.3). */
  @Patch(':projectId')
  @TargetRecord({ subject: PROJECT, param: 'projectId', action: 'update_settings' })
  @ResponseSchema(projectSchema)
  update(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: projectParamsSchema }) { projectId }: ProjectParams,
    @Body({ schema: updateProjectSchema }) input: UpdateProjectDto,
    @ExpectedVersion() version: number,
  ): Promise<Project> {
    return this.projects.update(principal, { id: projectId, version }, input);
  }

  /** Archives a project (§7.3). */
  @Put(':projectId/archive')
  @TargetRecord({ subject: PROJECT, param: 'projectId', action: 'archive' })
  @ResponseSchema(projectSchema)
  archive(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: projectParamsSchema }) { projectId }: ProjectParams,
    @ExpectedVersion() version: number,
  ): Promise<Project> {
    return this.projects.archive(principal, { id: projectId, version });
  }

  /** Unarchives a project (§7.3). */
  @Delete(':projectId/archive')
  @TargetRecord({ subject: PROJECT, param: 'projectId', action: 'unarchive' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  unarchive(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: projectParamsSchema }) { projectId }: ProjectParams,
    @ExpectedVersion() version: number,
  ): Promise<void> {
    return this.projects.unarchive(principal, { id: projectId, version });
  }

  /** Deletes a project with its memberships (§7.3). */
  @Delete(':projectId')
  @TargetRecord({ subject: PROJECT, param: 'projectId', action: 'delete' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  delete(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: projectParamsSchema }) { projectId }: ProjectParams,
    @ExpectedVersion() version: number,
  ): Promise<void> {
    return this.projects.delete(principal, { id: projectId, version });
  }

  /** The members of a project (§7.4). */
  @Get(':projectId/members')
  @TargetRecord({ subject: PROJECT, param: 'projectId', action: 'read_members' })
  @ResponseSchema(projectMemberPageSchema)
  listMembers(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: projectParamsSchema }) { projectId }: ProjectParams,
    @Query({ schema: listProjectMembersQuerySchema }) query: ListProjectMembersQuery,
  ): Promise<ProjectMemberPage> {
    return this.projects.listMembers(principal, projectId, query);
  }

  /** Adds an active team account to the project (§7.4). */
  @Post(':projectId/members')
  @TargetRecord({ subject: PROJECT, param: 'projectId', action: 'manage_members' })
  @ResponseSchema(projectMemberSchema, HttpStatus.CREATED)
  addMember(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: projectParamsSchema }) { projectId }: ProjectParams,
    @Body({ schema: addProjectMemberSchema }) input: AddProjectMemberDto,
  ): Promise<ProjectMember> {
    return this.projects.addMember(principal, projectId, input);
  }

  /** Changes the team role of a member (§7.4). */
  @Patch(':projectId/members/:userId')
  @TargetRecord({ subject: PROJECT, param: 'projectId', action: 'manage_members' })
  @ResponseSchema(projectMemberSchema)
  changeMemberRole(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: projectMemberParamsSchema }) { projectId, userId }: ProjectMemberParams,
    @Body({ schema: changeProjectMemberRoleSchema }) input: ChangeProjectMemberRoleDto,
  ): Promise<ProjectMember> {
    return this.projects.changeMemberRole(principal, projectId, userId, input);
  }

  /** Removes a member from the project (§7.4). */
  @Delete(':projectId/members/:userId')
  @TargetRecord({ subject: PROJECT, param: 'projectId', action: 'manage_members' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeMember(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: projectMemberParamsSchema }) { projectId, userId }: ProjectMemberParams,
  ): Promise<void> {
    return this.projects.removeMember(principal, projectId, userId);
  }

  /** The member picker: active team accounts that are not members (§7.4). */
  @Get(':projectId/member-candidates')
  @TargetRecord({ subject: PROJECT, param: 'projectId', action: 'manage_members' })
  @ResponseSchema(memberCandidatePageSchema)
  listMemberCandidates(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: projectParamsSchema }) { projectId }: ProjectParams,
    @Query({ schema: listMemberCandidatesQuerySchema }) query: ListMemberCandidatesQuery,
  ): Promise<MemberCandidatePage> {
    return this.projects.listMemberCandidates(principal, projectId, query);
  }
}
