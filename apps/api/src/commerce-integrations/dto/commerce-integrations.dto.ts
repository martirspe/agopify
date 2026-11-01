import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ConnectCommerceIntegrationDto {
  @ApiProperty({ example: 'Tienda principal' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ example: 'https://tienda.ejemplo.com' })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  baseUrl?: string;

  @ApiProperty({
    description: 'Platform-specific credentials (never echoed back).',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsObject()
  credentials!: Record<string, string>;
}

export class StartCommerceSyncDto {
  @ApiPropertyOptional({ enum: ['INITIAL', 'INCREMENTAL', 'RECONCILIATION'] })
  @IsOptional()
  @IsIn(['INITIAL', 'INCREMENTAL', 'RECONCILIATION'])
  syncType?: 'INITIAL' | 'INCREMENTAL' | 'RECONCILIATION';
}

export class UpdateCommerceSyncSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  automaticSyncEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncProducts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncVariants?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncInventory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncPrices?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncImages?: boolean;

  @ApiPropertyOptional({ enum: ['unpublish', 'ignore', 'archive'] })
  @IsOptional()
  @IsIn(['unpublish', 'ignore', 'archive'])
  deletionPolicy?: 'unpublish' | 'ignore' | 'archive';
}
