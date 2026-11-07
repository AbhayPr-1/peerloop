const path = require('node:path');
import type { ImageStorage } from './uploadService';

const PINATA_UPLOAD_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

export function createPinataStorage(): ImageStorage | null {
  const headers: Record<string, string> = {};
  if (process.env.PINATA_API_KEY && process.env.PINATA_API_SECRET) {
    headers.pinata_api_key = process.env.PINATA_API_KEY;
    headers.pinata_secret_api_key = process.env.PINATA_API_SECRET;
  } else if (process.env.PINATA_JWT) {
    headers.Authorization = `Bearer ${process.env.PINATA_JWT}`;
  } else {
    return null;
  }

  return {
    async pinImage(buffer, filename) {
      const name = path.basename(filename || 'product-image').slice(0, 120);
      const body = new FormData();
      body.append('file', new Blob([new Uint8Array(buffer)]), name);
      body.append('pinataMetadata', JSON.stringify({ name }));

      const response = await fetch(PINATA_UPLOAD_URL, {
        method: 'POST',
        headers,
        body
      });
      if (!response.ok) {
        throw new Error(`Pinata upload failed with status ${response.status} ${response.statusText}`);
      }

      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== 'object' ||
        !('IpfsHash' in result) ||
        typeof result.IpfsHash !== 'string'
      ) {
        throw new Error('Pinata upload response did not include an IPFS hash.');
      }

      return result.IpfsHash;
    }
  };
}
