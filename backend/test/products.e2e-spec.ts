import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ProductsModule } from '../src/modules/products/products.module';
import { Product } from '../src/modules/products/entities/product.entity';

describe('Products API (e2e)', () => {
  let app: INestApplication;
  let createdProductId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT) || 3306,
          username: process.env.DB_USERNAME || 'myapp_user',
          password: process.env.DB_PASSWORD || 'myapp_password',
          database: process.env.DB_NAME || 'myapp_db',
          entities: [Product],
          synchronize: true,
        }),
        ProductsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /products', () => {
    it('should create a product and return 201', async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .send({
          name: 'Test Product',
          description: 'A test product',
          price: 99.99,
          stock: 10,
          category: 'Test',
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Test Product');
      createdProductId = response.body.id;
    });

    it('should return 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'No price product' })
        .expect(400);
    });

    it('should return 400 when price is negative', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Bad product', price: -10, stock: 5 })
        .expect(400);
    });
  });

  describe('GET /products', () => {
    it('should return paginated products', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.total).toBeDefined();
      expect(response.body.page).toBeDefined();
      expect(response.body.totalPages).toBeDefined();
    });

    it('should filter by search term', async () => {
      const response = await request(app.getHttpServer())
        .get('/products?search=Test')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /products/:id', () => {
    it('should return the product by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/products/${createdProductId}`)
        .expect(200);

      expect(response.body.id).toBe(createdProductId);
    });

    it('should return 404 for non-existent product', async () => {
      await request(app.getHttpServer())
        .get('/products/999999')
        .expect(404);
    });

    it('should return 400 for invalid id format', async () => {
      await request(app.getHttpServer())
        .get('/products/not-a-number')
        .expect(400);
    });
  });

  describe('PUT /products/:id', () => {
    it('should update the product', async () => {
      const response = await request(app.getHttpServer())
        .put(`/products/${createdProductId}`)
        .send({ price: 149.99, stock: 20 })
        .expect(200);

      expect(Number(response.body.price)).toBe(149.99);
      expect(response.body.stock).toBe(20);
    });

    it('should return 404 for non-existent product', async () => {
      await request(app.getHttpServer())
        .put('/products/999999')
        .send({ price: 50 })
        .expect(404);
    });
  });

  describe('DELETE /products/:id', () => {
    it('should soft delete the product', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/products/${createdProductId}`)
        .expect(200);

      expect(response.body.message).toContain('successfully deleted');
    });

    it('should return 404 after deletion', async () => {
      await request(app.getHttpServer())
        .get(`/products/${createdProductId}`)
        .expect(404);
    });

    it('should return 404 for already deleted product', async () => {
      await request(app.getHttpServer())
        .delete(`/products/${createdProductId}`)
        .expect(404);
    });
  });
});