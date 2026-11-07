const path = require('node:path');
const { Readable } = require('node:stream');
const pinataSDK = require('@pinata/sdk');
import type { ImageStorage } from './uploadService';

export function createPinataStorage(): ImageStorage | null {
  let pinata: any;
  if (process.env.PINATA_API_KEY && process.env.PINATA_API_SECRET) {
    pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);
  } else if (process.env.PINATA_JWT) {
    pinata = new pinataSDK({ pinataJWTKey: process.env.PINATA_JWT });
  } else {
    return null;
  }

  return {
    async pinImage(buffer, filename) {
      const uploadStream = Readable.from(buffer);
      const name = path.basename(filename || 'product-image').slice(0, 120);
      const result = await pinata.pinFileToIPFS(uploadStream, {
        pinataMetadata: { name }
      });
      return result.IpfsHash;
    }
  };
}
