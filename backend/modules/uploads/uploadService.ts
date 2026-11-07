import { isValidImage } from './imageValidation';

export interface ImageStorage {
  pinImage(buffer: Buffer, filename: string): Promise<string>;
}

export class UploadServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly logMessage?: string
  ) {
    super(message);
    this.name = 'UploadServiceError';
  }
}

export interface UploadServiceDependencies {
  createStorage(): ImageStorage | null;
}

export function createUploadService(dependencies: UploadServiceDependencies) {
  return {
    async uploadImage(buffer: Buffer, mimeType: string, filename: string) {
      if (!isValidImage(buffer, mimeType)) {
        throw new UploadServiceError(400, 'Upload a valid JPEG, PNG, GIF, or WebP image.');
      }

      let storage: ImageStorage | null;
      try {
        storage = dependencies.createStorage();
      } catch (error) {
        throw new UploadServiceError(
          503,
          'Image uploads are not configured correctly.',
          `Pinata client configuration error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      if (!storage) {
        throw new UploadServiceError(503, 'Image uploads are not configured on the server.');
      }

      try {
        const ipfsHash = await storage.pinImage(buffer, filename);
        return { imageUrl: `ipfs://${ipfsHash}`, ipfsHash };
      } catch (error) {
        throw new UploadServiceError(
          502,
          'Image upload to Pinata failed.',
          `Pinata upload error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  };
}
