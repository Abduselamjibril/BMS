import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Auth } from '../../common/decorators/auth.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from '../users/dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';


@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 201, description: 'Login successful, returns JWT.' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ip = typeof req.ip === 'string' ? req.ip : '';
    const user = await this.authService.validateUser(loginDto, ip);
    return this.authService.login(user);
  }

  @Auth()
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile and permissions' })
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user);
  }

  @Auth()
  @Get('login-history')
  @ApiOperation({ summary: 'Get login history for current user' })
  async getLoginHistory(@Req() req: any) {
    return this.authService.getLoginHistory(req.user);
  }

  @Auth()
  @Get('refresh-token')
  @ApiOperation({ summary: 'Refresh JWT for long-lived mobile sessions' })
  async refresh(@Req() req: any) {
    return this.authService.refreshToken(req.user);
  }

  @Auth()
  @Post('change-password')
  @ApiOperation({ summary: 'Change current user password' })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto);
  }
}
