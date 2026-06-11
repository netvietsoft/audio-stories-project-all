import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

jest.mock('uploadthing/server', () => {
  const uploadFilesMock = jest.fn();

  return {
    UTApi: jest.fn().mockImplementation(() => ({
      uploadFiles: uploadFilesMock,
    })),
    __uploadFilesMock: uploadFilesMock,
  };
});

import { ImageUploadService } from './image-upload.service';

describe('ImageUploadService', () => {
  const uploadthingServer = jest.requireMock('uploadthing/server') as {
    UTApi: jest.Mock;
    __uploadFilesMock: jest.Mock;
  };

  beforeEach(() => {
    uploadthingServer.UTApi.mockClear();
    uploadthingServer.__uploadFilesMock.mockReset();
  });

  it('does not require UPLOADTHING_TOKEN during service construction', () => {
    expect(() => new ImageUploadService(new ConfigService({}))).not.toThrow();
    expect(uploadthingServer.UTApi).not.toHaveBeenCalled();
  });

  it('throws a clear error when image upload is attempted without UPLOADTHING_TOKEN', async () => {
    const service = new ImageUploadService(new ConfigService({}));

    await expect(
      service.uploadImage({
        originalname: 'cover.png',
        mimetype: 'image/png',
        buffer: Buffer.from('image-content'),
      }),
    ).rejects.toThrow(new BadRequestException('Missing UPLOADTHING_TOKEN configuration'));

    expect(uploadthingServer.UTApi).not.toHaveBeenCalled();
  });

  it('uploads via UTApi when UPLOADTHING_TOKEN is configured', async () => {
    uploadthingServer.__uploadFilesMock.mockResolvedValue({
      data: { url: 'https://uploadthing.example/cover.png' },
      error: null,
    });

    const service = new ImageUploadService(
      new ConfigService({ UPLOADTHING_TOKEN: 'uploadthing-token' }),
    );

    await expect(
      service.uploadImage({
        originalname: 'cover.png',
        mimetype: 'image/png',
        buffer: Buffer.from('image-content'),
      }),
    ).resolves.toBe('https://uploadthing.example/cover.png');

    expect(uploadthingServer.UTApi).toHaveBeenCalledWith({ token: 'uploadthing-token' });
    expect(uploadthingServer.__uploadFilesMock).toHaveBeenCalledTimes(1);
  });
});
