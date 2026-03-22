import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Owner } from './entities/owner.entity';
import { CreateOwnerDto } from './dto/create-owner.dto';

@Injectable()
export class OwnersService {
  constructor(
    @InjectRepository(Owner)
    private readonly ownerRepository: Repository<Owner>,
  ) {}

  async create(dto: CreateOwnerDto): Promise<Owner> {
    const owner = this.ownerRepository.create(dto);
    return this.ownerRepository.save(owner);
  }

  async findAll(): Promise<Owner[]> {
    return this.ownerRepository.find();
  }

  async findOne(id: string): Promise<Owner | null> {
    return this.ownerRepository.findOne({ where: { id } });
  }

  async update(
    id: string,
    dto: Partial<CreateOwnerDto>,
  ): Promise<Owner | null> {
    await this.ownerRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const owner = await this.ownerRepository.findOne({
      where: { id },
      relations: ['buildings'],
    });
    if (!owner) throw new BadRequestException('Owner not found');
    if (owner.buildings && owner.buildings.length > 0) {
      throw new BadRequestException('Cannot delete owner with buildings');
    }
    await this.ownerRepository.delete(id);
    return { message: 'Owner deleted successfully.' };
  }
}
