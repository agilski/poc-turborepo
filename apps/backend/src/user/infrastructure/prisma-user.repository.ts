import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../domain/user.repository';
import { UserWithoutPassword, UserWithPassword } from '../domain/user.entity';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private stripPassword(user: UserWithPassword): UserWithoutPassword {
    const { password: _, ...rest } = user;
    return rest;
  }

  async findById(id: string): Promise<UserWithoutPassword | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.stripPassword(user) : null;
  }

  async findByEmail(email: string): Promise<UserWithoutPassword | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.stripPassword(user) : null;
  }

  async findByEmailWithPassword(
    email: string,
  ): Promise<UserWithPassword | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findAll(): Promise<UserWithoutPassword[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.stripPassword(u));
  }

  async create(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.create({ data });
    return this.stripPassword(user);
  }

  async update(
    id: string,
    data: { email?: string; name?: string; password?: string },
  ): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.update({ where: { id }, data });
    return this.stripPassword(user);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
