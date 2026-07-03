import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(50)
  name!: string;

  @IsString()
  @MaxLength(50)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /** Mảng permission string (khớp chính xác với @Permissions(...)). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
