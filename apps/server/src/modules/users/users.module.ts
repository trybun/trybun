import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

/** Accounts (§7.4). */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
