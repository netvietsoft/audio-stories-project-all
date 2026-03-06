/// <reference types="multer" />
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private configService: ConfigService) {
        const region = this.configService.get<string>('AWS_REGION') || 'ap-southeast-1';
        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID')!;
        const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!;

        this.s3Client = new S3Client({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
        this.bucketName = this.configService.get<string>('AWS_BUCKET_NAME')!;
    }

    async uploadFile(file: Express.Multer.File, folder: string = 'audio'): Promise<string> {
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: this.bucketName,
                Key: fileName,
                Body: file.buffer,
                ContentType: file.mimetype,
            }),
        );

        const region = this.configService.get<string>('AWS_REGION') || 'ap-southeast-1';
        return `https://${this.bucketName}.s3.${region}.amazonaws.com/${fileName}`;
    }
}
