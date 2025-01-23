// src/app.ts
import dotenv from 'dotenv';
dotenv.config();

import minimist from 'minimist';
import { Connection } from '@solana/web3.js';
import { createConnection } from './config/connection';
import { BlockchainService } from './services/blockchain.service';
import { RaydiumService } from './services/raydium.service';
import { LiquidityService } from './services/liquidity.service';
import { DateRange } from './config/time';

// Parse command line arguments
const args = minimist(process.argv.slice(2), {
  boolean: ['live', 'history'],
  string: ['start', 'end'],
  alias: {
    s: 'start',
    e: 'end'
  }
});

async function main() {
  try {
    // Validate environment variables
    if (!process.env.SOLANA_HTTP_ENDPOINT || !process.env.SOLANA_WSS_ENDPOINT) {
      throw new Error("Missing Solana endpoint configuration in .env file");
    }

    // Initialize connection
    const connection = createConnection(
      process.env.SOLANA_HTTP_ENDPOINT,
      process.env.SOLANA_WSS_ENDPOINT
    );

    // Connection health check
    const slot = await connection.getSlot();
    console.log(`⛓ Connected to Solana mainnet | Current slot: ${slot}`);

    // Initialize services
    const blockchainService = new BlockchainService(connection);
    const liquidityService = new LiquidityService(connection);
    const raydiumService = new RaydiumService(blockchainService, liquidityService);

    // Historical analysis mode
    if (args.history) {
      if (!args.start || !args.end) {
        throw new Error("Historical analysis requires --start and --end dates (YYYY-MM-DD)");
      }

      const dateRange: DateRange = {
        start: new Date(args.start),
        end: new Date(args.end)
      };

      if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
      }

      console.log(`🔍 Analyzing historical data from ${dateRange.start} to ${dateRange.end}`);
      await raydiumService.analyzeHistoricalPools(dateRange);
      console.log('✅ Historical analysis completed');
      process.exit(0);
    }

    // Real-time monitoring mode
    if (args.live) {
      console.log('🕵️ Starting real-time Raydium LP monitoring...');
      
      setInterval(() => {
        console.log('💡 Monitoring active | Current time:', new Date().toLocaleTimeString());
      }, 60000);

      raydiumService.monitorNewPools(async (txSignature, [tokenA, tokenB]) => {
        console.log('\n🔔 New Pool Detected!');
        console.log(`📜 Transaction: https://solscan.io/tx/${txSignature}`);
        
        await raydiumService.trackPoolLiquidity(tokenA, tokenB);
        
        // Schedule periodic liquidity updates
        setInterval(async () => {
          await raydiumService.trackPoolLiquidity(tokenA, tokenB);
        }, 300000); // Update every 5 minutes
      });
    }

  } catch (error) {
    console.error('🔥 Application error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
