import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  changeRoleSchema,
  createAdminSchema,
  createEmployeeSchema,
  listPeopleQuerySchema,
  updateAdminSchema,
  updateEmployeeSchema,
  type AdminListItem,
  type ChangeRoleInput,
  type CreateAdminInput,
  type CreateEmployeeInput,
  type EmployeeDetail,
  type EmployeeListItem,
  type ListPeopleQuery,
  type PasswordResetIssued,
  type PeopleStats,
  type UpdateAdminInput,
  type UpdateEmployeeInput,
} from '@zemp/shared';
import { ClientInfo, CurrentUser, Now, RequirePermissions } from '../../common/auth.js';
import { Paged, zodPipe } from '../../common/http.js';
import type { SeedUser } from '../../data/store.service.js';
import type { ClientContext } from '../auth/auth.service.js';
import { PeopleService } from './people.service.js';

@ApiTags('people')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'People within the viewer’s scope' })
  list(
    @CurrentUser() user: SeedUser,
    @Query(zodPipe(listPeopleQuerySchema)) query: ListPeopleQuery,
    @Now() now: Date,
  ): Paged<EmployeeListItem> {
    return this.people.employees(user, query, now);
  }

  @Get('stats')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Headcount and workload averages within scope' })
  stats(@CurrentUser() user: SeedUser): PeopleStats {
    return this.people.stats(user);
  }

  @Post()
  @RequirePermissions('users.create')
  @ApiOperation({ summary: 'Create an employee' })
  create(
    @CurrentUser() user: SeedUser,
    @Body(zodPipe(createEmployeeSchema)) input: CreateEmployeeInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<EmployeeDetail> {
    return this.people.createEmployee(user, input, client, now);
  }

  /**
   * No `users.read` here on purpose: everyone may open their *own* profile, which is how the
   * Profile screen loads. `loadPerson` decides — self, or someone within the viewer's scope;
   * anyone else reads as not found.
   */
  @Get(':id')
  @ApiOperation({ summary: 'One person: yourself, or someone within your scope' })
  get(@CurrentUser() user: SeedUser, @Param('id', ParseUUIDPipe) id: string, @Now() now: Date): EmployeeDetail {
    return this.people.employee(user, id, now);
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  @ApiOperation({ summary: 'Edit a person, or move them between teams' })
  update(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(updateEmployeeSchema)) input: UpdateEmployeeInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): EmployeeDetail {
    return this.people.updateEmployee(user, id, input, client, now);
  }

  @Patch(':id/role')
  @RequirePermissions('users.delegate')
  @ApiOperation({ summary: 'Promote a team member to Sub Admin, or return them to Employee' })
  changeRole(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(changeRoleSchema)) input: ChangeRoleInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): EmployeeDetail {
    return this.people.changeRole(user, id, input, client, now);
  }
}

@ApiTags('people')
@Controller('admins')
export class AdminsController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Admins (Super Admin only)' })
  list(
    @CurrentUser() user: SeedUser,
    @Query(zodPipe(listPeopleQuerySchema)) query: ListPeopleQuery,
    @Now() now: Date,
  ): Paged<AdminListItem> {
    return this.people.admins(user, query, now);
  }

  @Post()
  @RequirePermissions('users.create')
  @ApiOperation({ summary: 'Create an admin and assign the teams they own' })
  create(
    @CurrentUser() user: SeedUser,
    @Body(zodPipe(createAdminSchema)) input: CreateAdminInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): Promise<AdminListItem> {
    return this.people.createAdmin(user, input, client, now);
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  @ApiOperation({ summary: 'Edit an admin or change the teams they own' })
  update(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(updateAdminSchema)) input: UpdateAdminInput,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): AdminListItem {
    return this.people.updateAdmin(user, id, input, client, now);
  }
}

@ApiTags('people')
@Controller('users')
export class AccountsController {
  constructor(private readonly people: PeopleService) {}

  @Post(':id/deactivate')
  @RequirePermissions('users.deactivate')
  @ApiOperation({ summary: 'Deactivate an account; their sessions end immediately' })
  deactivate(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): EmployeeDetail {
    return this.people.setActive(user, id, false, client, now);
  }

  @Post(':id/reactivate')
  @RequirePermissions('users.deactivate')
  @ApiOperation({ summary: 'Reactivate an account' })
  reactivate(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): EmployeeDetail {
    return this.people.setActive(user, id, true, client, now);
  }

  @Post(':id/password-reset')
  @RequirePermissions('users.update')
  @ApiOperation({ summary: 'Issue a single-use reset link for someone else' })
  reset(
    @CurrentUser() user: SeedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ClientInfo() client: ClientContext,
    @Now() now: Date,
  ): PasswordResetIssued {
    return this.people.issuePasswordReset(user, id, client, now);
  }
}

@Module({
  controllers: [EmployeesController, AdminsController, AccountsController],
  providers: [PeopleService],
})
export class PeopleModule {}
