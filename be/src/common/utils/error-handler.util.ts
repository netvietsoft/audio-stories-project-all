import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';

export function handlePrismaError(error: any, entityName: string = 'Resource'): never {
  console.error(`Error in ${entityName}:`, error);

  // If it's already a NestJS exception, rethrow it
  if (error instanceof BadRequestException || 
      error instanceof NotFoundException || 
      error instanceof ConflictException) {
    throw error;
  }

  // Handle Prisma errors
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const field = error.meta?.target?.[0] || 'field';
        throw new ConflictException(`${entityName} with this ${field} already exists`);
      
      case 'P2025':
        // Record not found
        throw new NotFoundException(`${entityName} not found`);
      
      case 'P2003':
        // Foreign key constraint violation
        throw new BadRequestException(`Invalid reference: related ${entityName.toLowerCase()} does not exist`);
      
      case 'P2014':
        // Required relation violation
        throw new BadRequestException(`Cannot delete ${entityName.toLowerCase()}: it has related records`);
      
      default:
        throw new BadRequestException(`Database error: ${error.message || 'Unknown error'}`);
    }
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    throw new BadRequestException(error.message);
  }

  // Generic error
  throw new BadRequestException(error.message || `Failed to process ${entityName.toLowerCase()}`);
}
