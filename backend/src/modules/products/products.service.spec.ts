import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

const mockProductRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  softDelete: jest.fn(),
};

const mockProduct: Product = {
  id: 1,
  name: 'iPhone 15 Pro',
  description: 'Latest iPhone',
  price: 999.99,
  stock: 50,
  category: 'Electronics',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: jest.Mocked<Repository<Product>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    repository = module.get(getRepositoryToken(Product));
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and return a product', async () => {
      const dto = {
        name: 'iPhone 15 Pro',
        description: 'Latest iPhone',
        price: 999.99,
        stock: 50,
        category: 'Electronics',
      };
      repository.create.mockReturnValue(mockProduct as any);
      repository.save.mockResolvedValue(mockProduct as any);

      const result = await service.create(dto as any);

      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(repository.save).toHaveBeenCalledWith(mockProduct);
      expect(result).toEqual(mockProduct);
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      repository.findAndCount.mockResolvedValue([[mockProduct], 1] as any);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual([mockProduct]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should return empty array when no products exist', async () => {
      repository.findAndCount.mockResolvedValue([[], 0] as any);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a product when it exists', async () => {
      repository.findOne.mockResolvedValue(mockProduct as any);

      const result = await service.findOne(1);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow('Product with ID 999 not found');
    });
  });

  describe('update', () => {
    it('should update and return the product', async () => {
      const updatedProduct = { ...mockProduct, price: 899.99 };
      repository.findOne.mockResolvedValue(mockProduct as any);
      repository.save.mockResolvedValue(updatedProduct as any);

      const result = await service.update(1, { price: 899.99 } as any);

      expect(result.price).toBe(899.99);
    });

    it('should throw NotFoundException for non-existent product', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update(999, { price: 899.99 } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete and return success message', async () => {
      repository.findOne.mockResolvedValue(mockProduct as any);
      repository.softDelete.mockResolvedValue(undefined as any);

      const result = await service.remove(1);

      expect(repository.softDelete).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Product 1 successfully deleted' });
    });

    it('should throw NotFoundException for non-existent product', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});