interface PeerLoopApiTransportDependencies {
  create(baseUrl: string, fetcher: typeof fetch, createFormData: () => FormData): PeerLoopApiClient;
}

class PeerLoopApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PeerLoopApiError';
    this.status = status;
  }
}

window.PeerLoopApiTransport = Object.freeze({
  create(baseUrl: string, fetcher: typeof fetch, createFormData: () => FormData): PeerLoopApiClient {
    async function request(path: string, options: RequestInit = {}, timeoutMs = 0): Promise<Response> {
      if (!path.startsWith('/')) throw new Error('API paths must start with a slash.');

      let timeout: ReturnType<typeof setTimeout> | undefined;
      let controller: AbortController | undefined;
      let removeAbortListener: (() => void) | undefined;
      let signal = options.signal;

      if (timeoutMs > 0) {
        controller = new AbortController();
        signal = controller.signal;
        timeout = setTimeout(() => controller?.abort(), timeoutMs);
        if (options.signal) {
          const abortFromCaller = () => controller?.abort(options.signal?.reason);
          if (options.signal.aborted) abortFromCaller();
          else {
            options.signal.addEventListener('abort', abortFromCaller, { once: true });
            removeAbortListener = () => options.signal?.removeEventListener('abort', abortFromCaller);
          }
        }
      }

      try {
        return await fetcher(`${baseUrl}${path}`, {
          ...options,
          credentials: options.credentials || 'include',
          signal
        });
      } finally {
        if (timeout) clearTimeout(timeout);
        removeAbortListener?.();
      }
    }

    async function readBody(response: Response): Promise<unknown> {
      try {
        const text = await response.text();
        if (!text) return null;
        try { return JSON.parse(text); } catch { return text; }
      } catch {
        return null;
      }
    }

    function bodyErrorMessage(body: unknown, fallback: string): string {
      if (typeof body === 'string' && body) return body;
      if (body && typeof body === 'object') {
        const record = body as { msg?: unknown; error?: unknown };
        if (typeof record.msg === 'string' && record.msg) return record.msg;
        if (typeof record.error === 'string' && record.error) return record.error;
      }
      return fallback;
    }

    async function responseError(response: Response, fallback: string): Promise<PeerLoopApiError> {
      return new PeerLoopApiError(bodyErrorMessage(await readBody(response), fallback), response.status);
    }

    async function readJson<T>(response: Response, fallback: string): Promise<T> {
      const body = await readBody(response);
      if (!response.ok) throw new PeerLoopApiError(bodyErrorMessage(body, fallback), response.status);
      if (body === null || typeof body === 'string') {
        throw new PeerLoopApiError('The server returned an invalid response.', response.status);
      }
      return body as T;
    }

    async function postJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
      const response = await request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return readJson<T>(response, fallback);
    }

    return {
      baseUrl,
      auth: {
        createChallenge: (walletAddress) => postJson<{ message: string }>('/api/auth/nonce', { walletAddress }, 'Could not start wallet sign-in'),
        signIn: (walletAddress, signature) => postJson<{ user: PeerLoopApiUser }>('/api/auth/metamask', { walletAddress, signature }, 'Login failed'),
        async getSession() {
          const response = await request('/api/auth/session', { cache: 'no-store' });
          if (response.status === 401) return null;
          return readJson<{ user?: PeerLoopApiUser }>(response, 'Could not restore the server session.');
        },
        async logout() {
          const response = await request('/api/auth/logout', { method: 'POST' });
          if (!response.ok) throw await responseError(response, 'Could not clear the server session.');
        }
      },
      uploads: {
        async uploadImage(file) {
          const formData = createFormData();
          formData.append('productImage', file);
          const response = await request('/api/upload', { method: 'POST', body: formData });
          return readJson<{ imageUrl: string; ipfsHash: string }>(response, 'Image upload failed.');
        }
      },
      listingMetadata: {
        async getAll(timeoutMs = 0) {
          const response = await request('/api/listing-metadata', { cache: 'no-store' }, timeoutMs);
          return readJson<Record<string, string>>(response, `Category service returned HTTP ${response.status}.`);
        },
        saveCategory: (productId, category, fallbackMessage = 'Could not save the category.') => postJson<{ productId: string; category: string }>(
          '/api/listing-metadata',
          { productId, category },
          fallbackMessage
        )
      },
      config: {
        async getRpcUrl(signal) {
          const response = await request('/api/config/rpc-url', { signal });
          return readJson<{ rpcUrl?: string }>(response, `Backend returned ${response.status}.`);
        }
      }
    };
  }
} satisfies PeerLoopApiTransportDependencies);
