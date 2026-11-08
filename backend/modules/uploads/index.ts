import { createPinataStorage } from './pinataStorage';
import config from '../../config';
import { createUploadService } from './uploadService';
import { createUploadRouter } from './router';

export { createUploadRouter } from './router';
export { createUploadService, UploadServiceError } from './uploadService';
export { isValidImage, MAX_IMAGE_BYTES } from './imageValidation';

export default createUploadRouter(createUploadService({
  createStorage: () => createPinataStorage(config.pinata)
}));
