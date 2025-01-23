// src/services/raydium.service.ts
import { 
  PublicKey, 
  ParsedTransactionWithMeta, 
  PartiallyDecodedInstruction,
  ParsedInstruction // Added missing import
} from '@solana/web3.js';
import { RAYDIUM_LP_PROGRAM_ID } from '../config/constants';
import { BlockchainService } from './blockchain.service';
import { LiquidityService } from './liquidity.service';
import { DateRange } from '../config/time';

export type PoolCallback = (txSignature: string, tokens: [string, string]) => Promise<void>;

export class RaydiumService {
  private readonly LP_ACCOUNT_INDICES = { TOKEN_A: 8, TOKEN_B: 9 };
  private readonly RPC_DELAY_MS = 500;

  constructor(
    private blockchainService: BlockchainService,
    private liquidityService: LiquidityService
  ) {}

  async monitorNewPools(callback: PoolCallback): Promise<void> {
    try {
      await this.blockchainService.listenForProgramLogs(
        new PublicKey(RAYDIUM_LP_PROGRAM_ID),
        'initialize2',
        async (signature: string) => {
          console.log(`🔎 Processing transaction: ${signature}`);
          const mints = await this.getPoolMintsFromTx(signature);
          if (mints) {
            await callback(signature, mints);
            console.log('✅ Successfully processed new LP');
          }
        }
      );
    } catch (error) {
      console.error('❌ Failed to start pool monitoring:', error);
      throw error;
    }
  }

  async analyzeHistoricalPools(dateRange: DateRange): Promise<void> {
    try {
      const signatures = await this.blockchainService.getHistoricalTransactions(
        new PublicKey(RAYDIUM_LP_PROGRAM_ID),
        dateRange
      );

      console.log(`🕰 Found ${signatures.length} historical transactions`);
      
      for (const [index, signature] of signatures.entries()) {
        console.log(`📜 Processing ${index + 1}/${signatures.length}: ${signature}`);
        const mints = await this.getPoolMintsFromTx(signature);
        
        if (mints) {
          await this.trackPoolLiquidity(mints[0], mints[1]);
          await new Promise(resolve => setTimeout(resolve, this.RPC_DELAY_MS));
        }
      }
    } catch (error) {
      console.error('❌ Historical analysis failed:', error);
      throw error;
    }
  }

  private async getPoolKeys(baseMint: PublicKey, quoteMint: PublicKey) {
    const [poolId] = await PublicKey.findProgramAddress(
      [Buffer.from('Pool'), baseMint.toBuffer(), quoteMint.toBuffer()],
      new PublicKey(RAYDIUM_LP_PROGRAM_ID)
    );
    return { id: poolId };
  }

  private async getPoolMintsFromTx(txId: string): Promise<[string, string] | undefined> {
    try {
      const tx = await this.blockchainService.getParsedTransaction(txId);
      
      if (!tx?.transaction) {
        console.log(`⚠️ Transaction not found: ${txId}`);
        return;
      }

      // Corrected type guard for Solana's parsed instructions
      const instruction = tx.transaction.message.instructions.find(
        (ix: ParsedInstruction | PartiallyDecodedInstruction): ix is PartiallyDecodedInstruction => {
          return (
            ix.programId.toBase58() === RAYDIUM_LP_PROGRAM_ID &&
            'accounts' in ix // Proper type narrowing
          );
        }
      );

      if (!instruction?.accounts) {
        console.log(`⚠️ No Raydium instruction found in: ${txId}`);
        return;
      }

      if (instruction.accounts.length < 10) {
        console.log(`⚠️ Invalid accounts array length in: ${txId}`);
        return;
      }

      const tokenA = instruction.accounts[this.LP_ACCOUNT_INDICES.TOKEN_A].toBase58();
      const tokenB = instruction.accounts[this.LP_ACCOUNT_INDICES.TOKEN_B].toBase58();

      console.log('🏊 New Liquidity Pool Detected');
      console.table({
        'Transaction': txId,
        'Token A Mint': tokenA,
        'Token B Mint': tokenB,
        'Explorer Link': `https://solscan.io/tx/${txId}`
      });

      return [tokenA, tokenB];
    } catch (error) {
      console.error(`❌ Error processing TX ${txId}:`, error);
      return undefined;
    }
  }

  public async trackPoolLiquidity(tokenA: string, tokenB: string): Promise<void> {
    try {
      const poolKeys = await this.getPoolKeys(new PublicKey(tokenA), new PublicKey(tokenB));
      const liquidity = await this.liquidityService.getPoolLiquidity(poolKeys.id);
      
      if (liquidity) {
        console.log('💰 Pool Liquidity:');
        console.table({
          'Token A Reserve': liquidity.baseReserve,
          'Token B Reserve': liquidity.quoteReserve,
          'LP Supply': liquidity.lpSupply,
          'Status': liquidity.status === 1 ? 'Active' : 'Inactive'
        });
      }
    } catch (error) {
      console.error('❌ Error tracking liquidity:', error);
      throw error;
    }
  }
}
