import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import { CurrentUser, Public } from '../common/decorators/auth.decorators';
import type { AuthUserPayload } from '../common/types/auth-user';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { CatalogImportService } from './catalog-import.service';
import { CatalogService } from './catalog.service';
import {
  CatalogImportCommitDto,
  CatalogImportPreviewDto,
} from './dto/catalog-import.dto';
import {
  ChangeProductStatusDto,
  CollectionProductsDto,
  CreateCollectionDto,
  ReplaceChannelListingsDto,
  UpdateCollectionDto,
} from './dto/collection.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { InventoryUpdateDto, MediaUploadDto } from './dto/inventory.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MEDIA_CACHE_CONTROL, MediaService } from './media.service';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly catalogImport: CatalogImportService,
    private readonly media: MediaService,
  ) {}

  @Get('products')
  list(@CurrentUser() user: AuthUserPayload) {
    return this.catalogService.list(user.tenantId);
  }

  @Get('categories')
  categories() {
    return this.catalogService.categories();
  }

  @Get('collections')
  listCollections(@CurrentUser() user: AuthUserPayload) {
    return this.catalogService.listCollections(user.tenantId);
  }

  @Post('collections')
  createCollection(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.catalogService.createCollection(user.tenantId, dto);
  }

  @Patch('collections/:collectionId')
  updateCollection(
    @CurrentUser() user: AuthUserPayload,
    @Param('collectionId') collectionId: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.catalogService.updateCollection(user.tenantId, collectionId, dto);
  }

  @Delete('collections/:collectionId')
  removeCollection(
    @CurrentUser() user: AuthUserPayload,
    @Param('collectionId') collectionId: string,
  ) {
    return this.catalogService.removeCollection(user.tenantId, collectionId);
  }

  @Put('collections/:collectionId/products')
  setCollectionProducts(
    @CurrentUser() user: AuthUserPayload,
    @Param('collectionId') collectionId: string,
    @Body() dto: CollectionProductsDto,
  ) {
    return this.catalogService.setCollectionProducts(
      user.tenantId,
      collectionId,
      dto,
    );
  }

  @Post('products')
  create(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateProductDto) {
    return this.catalogService.create(user.tenantId, dto);
  }

  @Get('products/:productId')
  getById(
    @CurrentUser() user: AuthUserPayload,
    @Param('productId') productId: string,
  ) {
    return this.catalogService.getById(user.tenantId, productId);
  }

  @Patch('products/:productId')
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogService.update(user.tenantId, productId, dto);
  }

  @Patch('products/:productId/status')
  changeStatus(
    @CurrentUser() user: AuthUserPayload,
    @Param('productId') productId: string,
    @Body() dto: ChangeProductStatusDto,
  ) {
    return this.catalogService.changeStatus(
      user.tenantId,
      productId,
      dto.status as ProductStatus,
    );
  }

  @Put('products/:productId/channel-listings')
  replaceChannelListings(
    @CurrentUser() user: AuthUserPayload,
    @Param('productId') productId: string,
    @Body() dto: ReplaceChannelListingsDto,
  ) {
    return this.catalogService.replaceChannelListings(
      user.tenantId,
      productId,
      dto.channelListings,
    );
  }

  @Delete('products/:productId')
  remove(
    @CurrentUser() user: AuthUserPayload,
    @Param('productId') productId: string,
  ) {
    return this.catalogService.remove(user.tenantId, productId);
  }

  @Get('inventory')
  inventory(@CurrentUser() user: AuthUserPayload) {
    return this.catalogService.inventory(user.tenantId);
  }

  @Patch('inventory')
  updateInventory(@CurrentUser() user: AuthUserPayload, @Body() dto: InventoryUpdateDto) {
    return this.catalogService.updateInventory(user.tenantId, dto);
  }

  @Post('media')
  @RateLimit('catalog-media', 30)
  upload(@CurrentUser() user: AuthUserPayload, @Body() dto: MediaUploadDto) {
    return this.media.upload(user.tenantId, dto);
  }

  /** ZIP with catalog.json + photos for re-import (manager only). */
  @Get('export')
  @RateLimit('catalog-export', 10)
  async exportCatalog(
    @CurrentUser() user: AuthUserPayload,
    @Res({ passthrough: false }) reply: FastifyReply,
  ) {
    const pack = await this.catalogImport.exportZip(user);
    if (pack.warnings.length) {
      reply.header(
        'X-Catalog-Export-Warnings',
        encodeURIComponent(JSON.stringify(pack.warnings)),
      );
    }
    return reply
      .header('Content-Type', 'application/zip')
      .header(
        'Content-Disposition',
        `attachment; filename="${pack.filename}"`,
      )
      .header('Cache-Control', 'no-store')
      .send(pack.bytes);
  }

  /** Validates a catalog package and returns what the import would do; writes nothing. */
  @Post('import/preview')
  @RateLimit('catalog-import', 30)
  previewImport(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CatalogImportPreviewDto,
  ) {
    return this.catalogImport.preview(user, dto);
  }

  /** Photo of a catalog package; the browser only sends the ones the preview asked for. */
  @Post('import/media')
  @RateLimit('catalog-import-media', 120)
  uploadImportMedia(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: MediaUploadDto,
  ) {
    return this.catalogImport.uploadPhoto(user, dto);
  }

  @Post('import')
  @RateLimit('catalog-import', 30)
  commitImport(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CatalogImportCommitDto,
  ) {
    return this.catalogImport.commit(user, dto);
  }
}

/** Uploaded product photos; names are random so they cannot be enumerated. */
@ApiTags('media')
@Public()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':file')
  async read(@Param('file') file: string, @Res() reply: FastifyReply) {
    const { bytes, contentType } = await this.media.read(file);
    return reply
      .header('Content-Type', contentType)
      .header('Cache-Control', MEDIA_CACHE_CONTROL)
      .header('X-Content-Type-Options', 'nosniff')
      .send(bytes);
  }
}
