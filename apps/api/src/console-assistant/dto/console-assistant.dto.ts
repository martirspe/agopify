import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const CONSOLE_ASSISTANT_CONVERSATION_ID =
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,63}$/;

export class UpdateConsoleAssistantPreferencesDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  memoryEnabled!: boolean;
}

export class ConsoleAssistantMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;

  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  @MaxLength(8000)
  text!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  status?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  bullets?: string[];
}

export class UpsertConsoleAssistantConversationDto {
  @ApiProperty({ example: 'Diseño de la portada' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  title!: string;

  @ApiProperty({ type: [ConsoleAssistantMessageDto] })
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => ConsoleAssistantMessageDto)
  messages!: ConsoleAssistantMessageDto[];
}

export class RenameConsoleAssistantConversationDto {
  @ApiProperty({ example: 'Diseño de la portada' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  title!: string;
}

export class ImportConsoleAssistantConversationsDto {
  @ApiProperty({ type: [Object] })
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ImportConsoleAssistantConversationItemDto)
  conversations!: ImportConsoleAssistantConversationItemDto[];
}

export class ImportConsoleAssistantConversationItemDto {
  @ApiProperty()
  @IsString()
  @Matches(CONSOLE_ASSISTANT_CONVERSATION_ID)
  id!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  title!: string;

  @ApiProperty({ type: [ConsoleAssistantMessageDto] })
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => ConsoleAssistantMessageDto)
  messages!: ConsoleAssistantMessageDto[];

  @ApiPropertyOptional({ description: 'Unix ms; defaults to now when omitted.' })
  @IsOptional()
  @IsInt()
  updatedAt?: number;
}
