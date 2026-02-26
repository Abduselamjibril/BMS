import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
  it('/documents/upload (POST) - upload document', async () => {
    const res = await request(app.getHttpServer())
      .post('/documents/upload')
      .field('module_type', 'lease')
      .field('module_id', 'test-lease-id')
      .attach('file', Buffer.from('dummy file content'), {
        filename: 'testfile.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.file_name).toBe('testfile.txt');
    expect(res.body.module_type).toBe('lease');
    expect(res.body.module_id).toBe('test-lease-id');
  });
});
