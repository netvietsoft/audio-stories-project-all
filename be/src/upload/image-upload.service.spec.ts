import { BadRequestException } from '@nestjs/common';

import type { AppConfigService } from '../shared/config/app-config.service';

jest.mock('@aws-sdk/client-s3', () => {
  const sendMock = jest.fn();

  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: jest
      .fn()
      .mockImplementation((input: unknown) => ({ __command: 'PutObjectCommand', input })),
    __sendMock: sendMock,
  };
});

import { ImageUploadService } from './image-upload.service';

const R2_CONFIG = {
  endpoint: 'https://accountid.r2.cloudflarestorage.com',
  accessKeyId: 'access-key',
  secretAccessKey: 'secret-key',
  bucketName: 'audio-truyen-r2',
  url: 'https://cdn.example.com/', // dấu / cuối để kiểm tra strip
};

function makeCfg(r2: Partial<typeof R2_CONFIG> = R2_CONFIG): AppConfigService {
  return { storage: { r2 } } as unknown as AppConfigService;
}

describe('ImageUploadService', () => {
  const s3 = jest.requireMock('@aws-sdk/client-s3') as {
    S3Client: jest.Mock;
    PutObjectCommand: jest.Mock;
    __sendMock: jest.Mock;
  };

  beforeEach(() => {
    s3.S3Client.mockClear();
    s3.PutObjectCommand.mockClear();
    s3.__sendMock.mockReset();
  });

  it('throws when required R2 configuration is missing', () => {
    expect(() => new ImageUploadService(makeCfg({}))).toThrow(
      new BadRequestException('Missing required Cloudflare R2 configuration'),
    );
    expect(s3.S3Client).not.toHaveBeenCalled();
  });

  it('uploads to R2 and returns the public URL under images/uploads', async () => {
    s3.__sendMock.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });

    const service = new ImageUploadService(makeCfg());

    const url = await service.uploadImage({
      originalname: 'cover.png',
      mimetype: 'image/png',
      buffer: Buffer.from('image-content'),
    });

    expect(url).toMatch(/^https:\/\/cdn\.example\.com\/images\/uploads\/\d+-[0-9a-f-]+\.png$/);
    expect(s3.__sendMock).toHaveBeenCalledTimes(1);

    const putInput = s3.PutObjectCommand.mock.calls[0][0];
    expect(putInput).toMatchObject({
      Bucket: 'audio-truyen-r2',
      ContentType: 'image/png',
    });
    expect(putInput.Key).toMatch(/^images\/uploads\/\d+-[0-9a-f-]+\.png$/);
  });

  it('wraps R2 upload failures in a 500 error', async () => {
    s3.__sendMock.mockRejectedValue(new Error('network down'));

    const service = new ImageUploadService(makeCfg());

    await expect(
      service.uploadImage({
        originalname: 'cover.png',
        mimetype: 'image/png',
        buffer: Buffer.from('image-content'),
      }),
    ).rejects.toThrow('Failed to upload image to Cloudflare R2');
  });
});
