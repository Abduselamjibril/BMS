import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  BadRequestException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User, UserStatus } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../roles/entities/user-role.entity';
import { Contractor } from '../maintenance/entities/contractor-and-workorder.entity';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Contractor)
    private readonly contractorRepository: Repository<Contractor>,
  ) {}

  /**
   * CREATE A NEW USER
   */
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

    const savedUser = await this.userRepository.save(user);

    // If role_id is provided, validate role existence and link to UserRole
    if (createUserDto.role_id) {
      const role = await this.roleRepository.findOne({ where: { id: createUserDto.role_id } });
      if (!role) {
        throw new BadRequestException('The provided role_id is invalid');
      }
      
      const userRole = this.userRoleRepository.create({ 
        user: savedUser, 
        role: role 
      });
      await this.userRoleRepository.save(userRole);
    }

    return savedUser;
  }

  /**
   * ROLE ASSIGNMENT
   */
  async assignRole(dto: AssignRoleDto) {
    const user = await this.userRepository.findOne({ where: { id: dto.user_id } });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.roleRepository.findOne({ where: { id: dto.role_id } });
    if (!role) throw new NotFoundException('Role not found');

    // Check if the user already has this role
    const existing = await this.userRoleRepository.findOne({ 
      where: { 
        user: { id: dto.user_id }, 
        role: { id: dto.role_id } 
      } 
    });

    let roleAssigned = false;
    if (!existing) {
      const userRole = this.userRoleRepository.create({ user, role });
      await this.userRoleRepository.save(userRole);
      roleAssigned = true;
    }

    // Always check and create Contractor entity if user has contractor role
    if (role.name === 'contractor') {
      const contractorExists = await this.contractorRepository.findOne({ where: { id: user.id } });
      if (!contractorExists) {
        const contractor = this.contractorRepository.create({
          id: user.id,
          name: user.name,
          phone: '',
          specialization: '',
          rating: 0,
          status: 'active'
        });
        await this.contractorRepository.save(contractor);
      }
    }

    return { message: roleAssigned ? 'Role assigned successfully to user' : 'User already has this role, contractor entity ensured' };
  }

  /**
   * RETRIEVAL METHODS
   */
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

  /**
   * UPDATES AND STATUS MANAGEMENT
   */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    // Handle password hashing if the password is being updated
    if (dto.password) {
      user.password_hash = await bcrypt.hash(dto.password, 10);
      // Remove plain password from DTO to prevent it from being mapped to a non-existent field
      delete dto.password;
    }

    // Merge other updates into the existing user object
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

  /**
   * HARD DELETE
   */
  async remove(id: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found or already deleted');
    }
    await this.userRepository.delete(id);
    return { message: 'User deleted successfully.' };
  }

  /**
   * DIRECT SAVE HELPER
   */
  async save(user: User): Promise<User> {
    return this.userRepository.save(user);
  }
}