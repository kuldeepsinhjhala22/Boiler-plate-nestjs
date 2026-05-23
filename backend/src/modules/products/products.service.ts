import {
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  private listCacheKey(query: QueryProductDto): string {
    const { page = 1, limit = 10, search = '', category = '', isActive = '' } = query;
    return `products:list:${page}:${limit}:${search}:${category}:${isActive}`;
  }

  private singleCacheKey(id: number): string {
    return `products:single:${id}`;
  }

  private async clearListCache(): Promise<void> {
    try {
      const store = this.cacheManager.stores[0];
      if (store && typeof (store as any).keys === 'function') {
        const keys: string[] = await (store as any).keys('products:list:*');
        await Promise.all(keys.map((key) => this.cacheManager.del(key)));
      }
    } catch (e) {
      console.warn('Cache clear failed, continuing...', e.message);
    }
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create(createProductDto);
    const saved = await this.productRepository.save(product);
    await this.clearListCache();
    return saved;
  }

  async findAll(query: QueryProductDto): Promise<{
    data: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const cacheKey = this.listCacheKey(query);

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        console.log(`🟢 Cache HIT: ${cacheKey}`);
        return cached as any;
      }
    } catch (e) {
      console.warn('Cache get failed, hitting DB...', e.message);
    }

    console.log(`🔴 Cache MISS: ${cacheKey}`);

    const { page = 1, limit = 10, search, category, isActive } = query;
    const where: any = {};
    if (search) where.name = Like(`%${search}%`);
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await this.productRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const result = {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };

    try {
      await this.cacheManager.set(cacheKey, result, 60000);
    } catch (e) {
      console.warn('Cache set failed, continuing...', e.message);
    }

    return result;
  }

  async findOne(id: number): Promise<Product> {
    const cacheKey = this.singleCacheKey(id);

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        console.log(`🟢 Cache HIT: ${cacheKey}`);
        return cached as Product;
      }
    } catch (e) {
      console.warn('Cache get failed, hitting DB...', e.message);
    }

    console.log(`🔴 Cache MISS: ${cacheKey}`);

    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    try {
      await this.cacheManager.set(cacheKey, product, 60000);
    } catch (e) {
      console.warn('Cache set failed, continuing...', e.message);
    }

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    const saved = await this.productRepository.save(product);
    await this.cacheManager.del(this.singleCacheKey(id));
    await this.clearListCache();
    return saved;
  }

  async remove(id: number): Promise<{ message: string }> {
    const product = await this.findOne(id);
    await this.productRepository.softDelete(product.id);
    await this.cacheManager.del(this.singleCacheKey(id));
    await this.clearListCache();
    return { message: `Product ${id} successfully deleted` };
  }
}