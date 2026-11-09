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
  Res,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiResponse } from '@nestjs/swagger';
import {
  type AddOrganizationMemberInput,
  addOrganizationMemberSchema,
  type CreateOrganizationInput,
  createOrganizationSchema,
  type ListOrganizationMembersQuery,
  listOrganizationMembersQuerySchema,
  type ListOrganizationsQuery,
  listOrganizationsQuerySchema,
  type Organization,
  type OrganizationMember,
  type OrganizationMemberPage,
  organizationMemberPageSchema,
  type OrganizationMemberParams,
  organizationMemberParamsSchema,
  organizationMemberSchema,
  type OrganizationPage,
  organizationPageSchema,
  type OrganizationParams,
  organizationParamsSchema,
  organizationSchema,
  type UpdateOrganizationDto,
  updateOrganizationSchema,
} from '@trybun/contracts/organizations';
import type { Response } from 'express';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { TargetRecord } from '../../platform/authorization/target-record.decorator.js';
import { ExpectedVersion } from '../../platform/http/expected-version.decorator.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { ORGANIZATION } from './organizations.abilities.js';
import { OrganizationsService } from './organizations.service.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  /** The organizations in one state (§7.3); the Administrator only. */
  @Get()
  @ResponseSchema(organizationPageSchema)
  list(
    @CurrentPrincipal() principal: Principal,
    @Query({ schema: listOrganizationsQuerySchema }) query: ListOrganizationsQuery,
  ): Promise<OrganizationPage> {
    return this.organizations.list(principal, query);
  }

  /** Creates an organization with its e-mail domains (§7.3). */
  @Post()
  @ResponseSchema(organizationSchema, HttpStatus.CREATED)
  create(
    @CurrentPrincipal() principal: Principal,
    @Body({ schema: createOrganizationSchema }) input: CreateOrganizationInput,
  ): Promise<Organization> {
    return this.organizations.create(principal, input);
  }

  @Get(':organizationId')
  @TargetRecord({ subject: ORGANIZATION, param: 'organizationId', action: 'read' })
  @ResponseSchema(organizationSchema)
  findOne(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: organizationParamsSchema }) { organizationId }: OrganizationParams,
  ): Promise<Organization> {
    return this.organizations.findOne(principal, organizationId);
  }

  /** Changes the name, the e-mail domains and the projects; the service checks each (§18.3). */
  @Patch(':organizationId')
  @TargetRecord({ subject: ORGANIZATION, param: 'organizationId', action: 'update' })
  @ResponseSchema(organizationSchema)
  update(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: organizationParamsSchema }) { organizationId }: OrganizationParams,
    @Body({ schema: updateOrganizationSchema }) input: UpdateOrganizationDto,
    @ExpectedVersion() version: number,
  ): Promise<Organization> {
    return this.organizations.update(principal, { id: organizationId, version }, input);
  }

  /** Archives an organization (§7.3). */
  @Put(':organizationId/archive')
  @TargetRecord({ subject: ORGANIZATION, param: 'organizationId', action: 'archive' })
  @ResponseSchema(organizationSchema)
  archive(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: organizationParamsSchema }) { organizationId }: OrganizationParams,
    @ExpectedVersion() version: number,
  ): Promise<Organization> {
    return this.organizations.archive(principal, { id: organizationId, version });
  }

  /** Unarchives an organization (§7.3). */
  @Delete(':organizationId/archive')
  @TargetRecord({ subject: ORGANIZATION, param: 'organizationId', action: 'unarchive' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  unarchive(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: organizationParamsSchema }) { organizationId }: OrganizationParams,
    @ExpectedVersion() version: number,
  ): Promise<void> {
    return this.organizations.unarchive(principal, { id: organizationId, version });
  }

  /** Deletes an organization with its domains, project access and memberships (§7.3). */
  @Delete(':organizationId')
  @TargetRecord({ subject: ORGANIZATION, param: 'organizationId', action: 'delete' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  delete(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: organizationParamsSchema }) { organizationId }: OrganizationParams,
    @ExpectedVersion() version: number,
  ): Promise<void> {
    return this.organizations.delete(principal, { id: organizationId, version });
  }

  /** The members of an organization (§7.3). */
  @Get(':organizationId/members')
  @TargetRecord({ subject: ORGANIZATION, param: 'organizationId', action: 'read' })
  @ResponseSchema(organizationMemberPageSchema)
  listMembers(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: organizationParamsSchema }) { organizationId }: OrganizationParams,
    @Query({ schema: listOrganizationMembersQuerySchema }) query: ListOrganizationMembersQuery,
  ): Promise<OrganizationMemberPage> {
    return this.organizations.listMembers(principal, organizationId, query);
  }

  /**
   * Adds an end user by e-mail address, or moves them with `move` (§7.3): `201`, or `200` when
   * they are a member already.
   */
  @Post(':organizationId/members')
  @TargetRecord({ subject: ORGANIZATION, param: 'organizationId', action: 'manage_members' })
  @ResponseSchema(organizationMemberSchema, HttpStatus.CREATED)
  @ApiResponse({
    status: HttpStatus.OK,
    standardSchema: organizationMemberSchema,
    description: 'The account is a member already; nothing changed.',
  })
  async addMember(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: organizationParamsSchema }) { organizationId }: OrganizationParams,
    @Body({ schema: addOrganizationMemberSchema }) input: AddOrganizationMemberInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OrganizationMember> {
    const { member, isNew } = await this.organizations.addMember(principal, organizationId, input);
    if (!isNew) {
      response.status(HttpStatus.OK);
    }
    return member;
  }

  /** Removes a member from the organization (§7.3). */
  @Delete(':organizationId/members/:userId')
  @TargetRecord({ subject: ORGANIZATION, param: 'organizationId', action: 'manage_members' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeMember(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: organizationMemberParamsSchema })
    { organizationId, userId }: OrganizationMemberParams,
  ): Promise<void> {
    return this.organizations.removeMember(principal, organizationId, userId);
  }
}
