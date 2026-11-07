const crypto = require('crypto');
const { ethers } = require('ethers');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface AuthUser {
  id: string;
  name: string;
  walletAddress: string;
  loginNonce?: string | null;
  loginNonceExpiresAt?: Date | null;
}

export interface AuthUserRepository {
  findByWallet(walletAddress: string, includeChallenge?: boolean): Promise<AuthUser | null>;
  createUser(name: string, walletAddress: string): Promise<AuthUser>;
  saveChallenge(userId: string, nonce: string, expiresAt: Date): Promise<void>;
  consumeChallenge(userId: string, nonce: string, now: Date): Promise<AuthUser | null>;
}

export interface AuthServiceDependencies {
  users: AuthUserRepository;
  appOrigin: string;
  jwtSecret?: string;
  now?: () => Date;
  createNonce?: (byteLength: number) => string;
  verifyMessage?: (message: string, signature: string) => string;
  signToken?: (payload: object, secret: string) => Promise<string>;
}

export class AuthServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly logMessage?: string
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

export function createAuthService(dependencies: AuthServiceDependencies) {
  const now = dependencies.now || (() => new Date());
  const createNonce = dependencies.createNonce || ((byteLength: number) =>
    crypto.randomBytes(byteLength).toString('hex'));
  const verifyMessage = dependencies.verifyMessage || ethers.verifyMessage;
  const signToken = dependencies.signToken || ((payload: object, secret: string) =>
    new Promise<string>((resolve, reject) => {
      require('jsonwebtoken').sign(payload, secret, { expiresIn: '24h' }, (error: Error | null, token?: string) => {
        if (error) reject(error);
        else if (token) resolve(token);
        else reject(new Error('JWT signing returned no token.'));
      });
    }));

  function normalizeWalletAddress(value: unknown): string | null {
    if (typeof value !== 'string' || !ethers.isAddress(value)) return null;
    return ethers.getAddress(value).toLowerCase();
  }

  function buildLoginMessage(walletAddress: string, nonce: string): string {
    return [
      'PeerLoop sign-in request',
      `Origin: ${dependencies.appOrigin}`,
      `Address: ${walletAddress}`,
      `Nonce: ${nonce}`
    ].join('\n');
  }

  async function createChallenge(value: unknown): Promise<{ message: string }> {
    const walletAddress = normalizeWalletAddress(value);
    if (!walletAddress) {
      throw new AuthServiceError(400, 'A valid wallet address is required.');
    }

    let user = await dependencies.users.findByWallet(walletAddress);
    if (!user) {
      const suffix = createNonce(4);
      user = await dependencies.users.createUser(
        `User-${walletAddress.slice(2, 8)}-${suffix}`,
        walletAddress
      );
    }

    const nonce = createNonce(32);
    await dependencies.users.saveChallenge(
      user.id,
      nonce,
      new Date(now().getTime() + CHALLENGE_TTL_MS)
    );
    return { message: buildLoginMessage(walletAddress, nonce) };
  }

  async function signIn(
    addressValue: unknown,
    signatureValue: unknown
  ): Promise<{ token: string; user: Pick<AuthUser, 'id' | 'name' | 'walletAddress'> }> {
    const walletAddress = normalizeWalletAddress(addressValue);
    if (!walletAddress || typeof signatureValue !== 'string' || !signatureValue) {
      throw new AuthServiceError(400, 'A valid wallet address and signature are required.');
    }
    if (!dependencies.jwtSecret) {
      throw new AuthServiceError(503, 'Wallet sign-in is not configured on the server.');
    }

    const user = await dependencies.users.findByWallet(walletAddress, true);
    const currentTime = now();
    if (!user || !user.loginNonce || !user.loginNonceExpiresAt || user.loginNonceExpiresAt <= currentTime) {
      throw new AuthServiceError(401, 'Sign-in challenge expired. Please try again.');
    }

    let recoveredAddress: string;
    try {
      recoveredAddress = verifyMessage(
        buildLoginMessage(walletAddress, user.loginNonce),
        signatureValue
      ).toLowerCase();
    } catch {
      throw new AuthServiceError(401, 'Wallet signature is not valid.');
    }
    if (recoveredAddress !== walletAddress) {
      throw new AuthServiceError(401, 'Wallet signature does not match the requested address.');
    }

    const authenticatedUser = await dependencies.users.consumeChallenge(
      user.id,
      user.loginNonce,
      currentTime
    );
    if (!authenticatedUser) {
      throw new AuthServiceError(401, 'Sign-in challenge has already been used. Please try again.');
    }

    const tokenUser = {
      id: authenticatedUser.id,
      name: authenticatedUser.name,
      walletAddress: authenticatedUser.walletAddress
    };
    const payload = { authVersion: 2, user: tokenUser };
    let token: string;
    try {
      token = await signToken(payload, dependencies.jwtSecret);
    } catch (error) {
      throw new AuthServiceError(
        500,
        'Could not complete wallet sign-in.',
        `JWT creation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return { token, user: tokenUser };
  }

  return { createChallenge, signIn };
}
