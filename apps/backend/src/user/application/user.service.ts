import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../domain/user.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserWithoutPassword } from '../domain/user.entity';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findAll(): Promise<UserWithoutPassword[]> {
    return this.userRepository.findAll();
  }

  async findById(id: string): Promise<UserWithoutPassword> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserWithoutPassword> {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.email && updateUserDto.email !== existing.email) {
      const emailTaken = await this.userRepository.findByEmail(
        updateUserDto.email,
      );
      if (emailTaken) {
        throw new ConflictException('Email already in use');
      }
    }

    const data: { email?: string; name?: string; password?: string } = {};
    if (updateUserDto.email !== undefined) data.email = updateUserDto.email;
    if (updateUserDto.name !== undefined) data.name = updateUserDto.name;
    if (updateUserDto.password !== undefined) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.userRepository.update(id, data);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.delete(id);
  }
}
