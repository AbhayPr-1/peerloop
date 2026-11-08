import type { Request, Response } from 'express';
import config from '../../config';
import { AuthServiceError } from './authService';

interface AuthService {
  createChallenge(walletAddress: unknown): Promise<{ message: string }>;
  signIn(walletAddress: unknown, signature: unknown): Promise<{
    token: string;
    user: { id: string; name: string; walletAddress: string };
  }>;
}

export function createAuthController(authService: AuthService, isProduction = config.isProduction) {
  return {
    async createChallenge(req: Request, res: Response) {
      try {
        const result = await authService.createChallenge(req.body?.walletAddress);
        res.set('Cache-Control', 'no-store');
        return res.json(result);
      } catch (error) {
        if (error instanceof AuthServiceError) {
          if (error.logMessage) console.error(error.logMessage);
          return res.status(error.statusCode).json({ msg: error.message });
        }
        console.error(
          'Wallet challenge creation failed:',
          error instanceof Error ? error.message : error
        );
        return res.status(500).json({ msg: 'Could not start wallet sign-in.' });
      }
    },

    async signIn(req: Request, res: Response) {
      try {
        const { walletAddress, signature } = req.body || {};
        const result = await authService.signIn(walletAddress, signature);
        const production = isProduction;
        const cookieName = production ? '__Host-peerloop_session' : 'peerloop_session';
        res.cookie(cookieName, result.token, {
          httpOnly: true,
          secure: production,
          sameSite: production ? 'none' : 'lax',
          path: '/',
          maxAge: 24 * 60 * 60 * 1000
        });
        res.set('Cache-Control', 'no-store');
        return res.json({ user: result.user });
      } catch (error) {
        if (error instanceof AuthServiceError) {
          if (error.logMessage) console.error(error.logMessage);
          return res.status(error.statusCode).json({ msg: error.message });
        }
        console.error(
          'Wallet sign-in failed:',
          error instanceof Error ? error.message : error
        );
        return res.status(500).json({ msg: 'Server error during wallet sign-in.' });
      }
    }
  };
}
