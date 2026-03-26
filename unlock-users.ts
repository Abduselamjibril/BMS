import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserStatus } from './src/modules/users/entities/user.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userRepo = app.get(getRepositoryToken(User));

  const lockedUsers = await userRepo.find({
    where: [
      { status: UserStatus.LOCKED },
      { locked_until: require('typeorm').MoreThan(new Date()) }
    ]
  });

  console.log(`Found ${lockedUsers.length} locked users.`);

  for (const user of lockedUsers) {
    user.status = UserStatus.ACTIVE;
    user.locked_until = null;
    user.failed_login_attempts = 0;
    await userRepo.save(user);
    console.log(`Unlocked user: ${user.email}`);
  }

  await app.close();
  console.log('Unlock complete.');
}

bootstrap();
