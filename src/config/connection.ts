import { Connection, ConnectionConfig } from '@solana/web3.js';

export const createConnection = (httpUrl: string, wssUrl: string): Connection => {
  const config: ConnectionConfig = {
    wsEndpoint: wssUrl,
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000
  };
  
  return new Connection(httpUrl, config);
};
