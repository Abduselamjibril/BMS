import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { email: createUserDto.email } });
    if (existing) throw new ConflictException('Email already in use');
    const user = this.userRepository.create({
      ...createUserDto,
      password_hash: await bcrypt.hash(createUserDto.password, 10),
      status: createUserDto.status ?? UserStatus.ACTIVE,
    });
    return this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: Partial<User>): Promise<User> {
    await this.userRepository.update(id, dto);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.INACTIVE;
    await this.userRepository.save(user);
    return user;
  }

  async save(user: User): Promise<User> {
    return this.userRepository.save(user);
  }
}
