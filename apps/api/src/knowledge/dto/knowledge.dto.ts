import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KNOWLEDGE_TOPICS } from '../knowledge-topics';

export class CreateKnowledgeFaqDto {
  @ApiProperty({ example: '¿Hacen envíos a provincia?' })
  @IsString()
  @MinLength(4)
  @MaxLength(300)
  question!: string;

  @ApiProperty({ example: 'Sí, enviamos a todo el Perú en 2–5 días hábiles.' })
  @IsString()
  @MinLength(4)
  @MaxLength(2000)
  answer!: string;

  @ApiPropertyOptional({ enum: KNOWLEDGE_TOPICS, default: 'GENERAL' })
  @IsOptional()
  @IsIn([...KNOWLEDGE_TOPICS])
  topic?: (typeof KNOWLEDGE_TOPICS)[number];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateKnowledgeFaqDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(300)
  question?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(2000)
  answer?: string;

  @ApiPropertyOptional({ enum: KNOWLEDGE_TOPICS })
  @IsOptional()
  @IsIn([...KNOWLEDGE_TOPICS])
  topic?: (typeof KNOWLEDGE_TOPICS)[number];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ enum: ['DRAFT', 'APPROVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'APPROVED'])
  reviewStatus?: 'DRAFT' | 'APPROVED';
}

export class ImportKnowledgePasteDto {
  @ApiProperty({
    description:
      'Bulk paste: one FAQ per block separated by blank lines, or Q:/A: lines',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(20000)
  rawText!: string;

  @ApiPropertyOptional({ enum: KNOWLEDGE_TOPICS, default: 'GENERAL' })
  @IsOptional()
  @IsIn([...KNOWLEDGE_TOPICS])
  topic?: (typeof KNOWLEDGE_TOPICS)[number];
}

export class ApplyKnowledgeTemplatesDto {
  @ApiProperty({
    enum: KNOWLEDGE_TOPICS,
    isArray: true,
    example: ['SHIPPING', 'RETURNS', 'PAYMENTS'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(KNOWLEDGE_TOPICS.length)
  @IsIn([...KNOWLEDGE_TOPICS], { each: true })
  topics!: Array<(typeof KNOWLEDGE_TOPICS)[number]>;
}

export class CreateJourneyTemplateDto {
  @ApiProperty({ example: 'Cierre con link de pago' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ enum: ['DISCOVER', 'RECOMMEND', 'CLOSE', 'SUPPORT'] })
  @IsIn(['DISCOVER', 'RECOMMEND', 'CLOSE', 'SUPPORT'])
  stage!: 'DISCOVER' | 'RECOMMEND' | 'CLOSE' | 'SUPPORT';

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  scriptText!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateJourneyTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ enum: ['DISCOVER', 'RECOMMEND', 'CLOSE', 'SUPPORT'] })
  @IsOptional()
  @IsIn(['DISCOVER', 'RECOMMEND', 'CLOSE', 'SUPPORT'])
  stage?: 'DISCOVER' | 'RECOMMEND' | 'CLOSE' | 'SUPPORT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  scriptText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
