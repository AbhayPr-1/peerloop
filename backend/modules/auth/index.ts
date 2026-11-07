import { createAuthService } from './authService';
import { createMongooseAuthUserRepository } from './userRepository';
import { createAuthRouter } from './router';
import config from '../../config';

export { createAuthRouter, createAuthService };
export type { AuthServiceDependencies, AuthUser, AuthUserRepository } from './authService';

const authService = createAuthService({
  users: createMongooseAuthUserRepository(),
  appOrigin: config.appOrigin,
  jwtSecret: config.jwtSecret
});

export default createAuthRouter(authService);
