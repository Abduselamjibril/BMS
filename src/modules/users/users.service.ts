import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  BadRequestException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({ 
      where: { email: createUserDto.email } 
    });
    
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      ...createUserDto,
      password_hash: hashedPassword,
      status: createUserDto.status ?? UserStatus.ACTIVE,
    });

    const saved = await this.userRepository.save(user);

    // If role_id provided, validate and create UserRole link
    if (createUserDto.role_id) {
      const role = await this.roleRepository.findOne({ where: { id: createUserDto.role_id } });
      if (!role) throw new BadRequestException('role_id is invalid');
      const ur = this.userRoleRepository.create({ user: saved as any, role: role as any });
      await this.userRoleRepository.save(ur);
    }

    return saved;
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    // If a password is provided in the update DTO, hash it before saving
    if (dto.password) {
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      // Map the DTO password to the entity password_hash field
      (user as any).password_hash = hashedPassword;
      // Remove the plain password from the DTO so Object.assign doesn't overwrite
      delete dto.password;
    }

    // Merge other updates
    Object.assign(user, dto);
    
    return this.userRepository.save(user);
  }

  async activate(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.ACTIVE;
    return this.userRepository.save(user);
  }

  async softDelete(id: string): Promise<User> {
    const user = await this.findById(id);
    user.status = UserStatus.INACTIVE;
    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      return { message: 'User not found or already deleted.' };
    }
    await this.userRepository.delete(id);
    return { message: 'User deleted successfully.' };
  }

  async save(user: User): Promise<User> {
    return this.userRepository.save(user);
  }
}