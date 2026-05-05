import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Owner } from './entities/owner.entity';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { User, UserStatus } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../roles/entities/user-role.entity';

@Injectable()
export class OwnersService {
  constructor(
    @InjectRepository(Owner)
    private readonly ownerRepository: Repository<Owner>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  /**
   * Create owner AND auto-create a user account with the 'owner' role.
   */
  async create(dto: CreateOwnerDto): Promise<Owner> {
    if (!dto.email) {
      throw new BadRequestException('Email is required for owner registration');
    }
    if (!dto.password) {
      throw new BadRequestException('Password is required for owner registration');
    }

    // 1. Create the Owner entity
    const ownerData: Partial<Owner> = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      profile_image: dto.profile_image,
    };
    const owner = this.ownerRepository.create(ownerData);
    const savedOwner = await this.ownerRepository.save(owner);

    // 2. Auto-create a User account (or find existing one)
    let user = await this.userRepository.findOne({ where: { email: dto.email } });
    if (!user) {
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      user = this.userRepository.create({
        name: dto.name,
        email: dto.email,
        password_hash: hashedPassword,
        status: UserStatus.ACTIVE,
      });
      await this.userRepository.save(user);
    }

    // 3. Assign the 'owner' role if not already assigned
    const ownerRole = await this.roleRepository.findOne({ where: { name: 'owner' } });
    if (ownerRole && user) {
      const existingUserRole = await this.userRoleRepository.findOne({
        where: { user: { id: user.id }, role: { id: ownerRole.id } },
      });
      if (!existingUserRole) {
        const userRole = this.userRoleRepository.create({ user, role: ownerRole });
        await this.userRoleRepository.save(userRole);
      }
      
      // Link Owner to User
      if (!savedOwner.user_id) {
        await this.ownerRepository.update(savedOwner.id, { user_id: user.id });
        savedOwner.user_id = user.id;
      }
    }

    return savedOwner;
  }

  async findAll(): Promise<Owner[]> {
    return this.ownerRepository.find({ relations: ['buildings'] });
  }

  async findOne(id: string): Promise<Owner | null> {
    return this.ownerRepository.findOne({ where: { id } });
  }

  /**
   * Update owner AND sync the linked user account (name + email).
   */
  async update(
    id: string,
    dto: Partial<CreateOwnerDto>,
  ): Promise<Owner | null> {
    const owner = await this.ownerRepository.findOne({ where: { id } });
    if (!owner) throw new BadRequestException('Owner not found');

    const oldEmail = owner.email;

    // Update owner fields
    const updateData: Partial<Owner> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.profile_image !== undefined) updateData.profile_image = dto.profile_image;

    await this.ownerRepository.update(id, updateData);

    // Sync linked user account by old email
    if (oldEmail) {
      const linkedUser = await this.userRepository.findOne({ where: { email: oldEmail } });
      if (linkedUser) {
        if (dto.name !== undefined) linkedUser.name = dto.name;
        if (dto.email !== undefined) linkedUser.email = dto.email;
        await this.userRepository.save(linkedUser);
      }
    }

    return this.findOne(id);
  }

  /**
   * Delete owner AND deactivate the linked user account.
   */
  async remove(id: string): Promise<{ message: string }> {
    const owner = await this.ownerRepository.findOne({
      where: { id },
      relations: ['buildings'],
    });
    if (!owner) throw new BadRequestException('Owner not found');
    if (owner.buildings && owner.buildings.length > 0) {
      throw new BadRequestException('Cannot delete owner with buildings');
    }

    // Deactivate the linked user account
    if (owner.email) {
      const linkedUser = await this.userRepository.findOne({ where: { email: owner.email } });
      if (linkedUser) {
        linkedUser.status = UserStatus.INACTIVE;
        await this.userRepository.save(linkedUser);
      }
    }

    await this.ownerRepository.delete(id);
    return { message: 'Owner deleted and user account deactivated.' };
  }
}
