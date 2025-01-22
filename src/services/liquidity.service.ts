// src/services/liquidity.service.ts
import { Connection, PublicKey } from '@solana/web3.js';
import { Layout, struct, nu64 } from '@solana/buffer-layout';

// Define custom uint64 layout for BigInt handling
function uint64Layout(property?: string): Layout<number> {
  return nu64(property);
}

interface PoolState {
  status: number;
  baseReserve: number;
  quoteReserve: number;
  lpReserve: number;
}

const LIQUIDITY_STATE_LAYOUT = struct<PoolState>([
  uint64Layout('status'),
  uint64Layout('baseReserve'),
  uint64Layout('quoteReserve'),
  uint64Layout('lpReserve'),
]);

export class LiquidityService {
  constructor(private connection: Connection) {}

  async getPoolLiquidity(poolAddress: PublicKey) {
    try {
      const accountInfo = await this.connection.getAccountInfo(poolAddress);
      
      if (!accountInfo?.data) {
        console.log(`No data found for pool address: ${poolAddress.toString()}`);
        return null;
      }

      const poolState = LIQUIDITY_STATE_LAYOUT.decode(accountInfo.data);

      return {
        baseReserve: poolState.baseReserve,
        quoteReserve: poolState.quoteReserve,
        lpSupply: poolState.lpReserve,
        status: poolState.status
      };
    } catch (error) {
      console.error(`Error fetching liquidity for pool ${poolAddress.toString()}:`, error);
      return null;
    }
  }
}
