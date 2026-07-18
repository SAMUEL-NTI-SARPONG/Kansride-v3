import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.userId);
  }
}
