import { Connection } from '@solana/web3.js';

export const createConnection = (httpUrl: string, wssUrl: string): Connection => 
  new Connection(httpUrl, {
    wsEndpoint: wssUrl,
    commitment: 'confirmed'
  });