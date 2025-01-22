import dotenv from 'dotenv';
dotenv.config();

import { Connection } from '@solana/web3.js';
import { createConnection } from './config/connection';
import { BlockchainService } from './services/blockchain.service';
import { RaydiumService } from './services/raydium.service';
import { LiquidityService } from './services/liquidity.service';

async function main() {
  try {
    if (!process.env.SOLANA_HTTP_ENDPOINT || !process.env.SOLANA_WSS_ENDPOINT) {
      throw new Error("Missing Solana endpoint configuration in .env file");
    }

    const connection = createConnection(
      process.env.SOLANA_HTTP_ENDPOINT,
      process.env.SOLANA_WSS_ENDPOINT
    );

    // Connection health check
    try {
      const slot = await connection.getSlot();
      console.log(`⛓ Connection established! Current slot: ${slot}`);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Connection health check failed: ${error.message}`);
      }
      throw new Error('Connection health check failed with unknown error');
    }

    const blockchainService = new BlockchainService(connection);
    const liquidityService = new LiquidityService(connection);
    const raydiumService = new RaydiumService(blockchainService, liquidityService);

    console.log('🕵️ Starting Raydium LP monitoring...');
    
    setInterval(() => {
      console.log('💡 Monitoring active...', new Date().toLocaleTimeString());
    }, 60000);

    raydiumService.monitorNewPools(async (txSignature, [tokenA, tokenB]) => {
      console.log('🔔 New Pool Detected! Tracking liquidity...');
      await raydiumService.trackPoolLiquidity(tokenA, tokenB);
      
      setInterval(async () => {
        await raydiumService.trackPoolLiquidity(tokenA, tokenB);
      }, 300_000);
    });

  } catch (error) {
    console.error('🔥 Application failed to start:', error);
    process.exit(1);
  }
}

main();
