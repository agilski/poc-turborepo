import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserService } from '../application/user.service';
import { UpdateUserDto } from '../application/dto/update-user.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: { userId: string; email: string },
  ) {
    if (currentUser.userId !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: { userId: string; email: string },
  ) {
    if (currentUser.userId !== id) {
      throw new ForbiddenException('You can only delete your own profile');
    }
    await this.userService.delete(id);
  }
}
