import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const apiKey = request.headers['x-internal-api-key'] as string;

        const validApiKey = this.configService.get<string>('INTERNAL_API_KEY');

        if (!validApiKey) {
            console.warn('[InternalApiKeyGuard] INTERNAL_API_KEY not configured - denying access');
            throw new UnauthorizedException('Internal API not configured');
        }

        if (!apiKey) {
            throw new UnauthorizedException('Missing internal API key');
        }

        if (apiKey !== validApiKey) {
            throw new UnauthorizedException('Invalid internal API key');
        }

        return true;
    }
}
