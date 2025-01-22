import { PublicKey, ParsedTransactionWithMeta, PartiallyDecodedInstruction } from '@solana/web3.js';
import { RAYDIUM_LP_PROGRAM_ID } from '../config/constants';
import { BlockchainService } from './blockchain.service';
import { LiquidityService } from './liquidity.service';

export class RaydiumService {
  private readonly LP_ACCOUNT_INDICES = { TOKEN_A: 8, TOKEN_B: 9 };

  constructor(
    private blockchainService: BlockchainService,
    private liquidityService: LiquidityService
  ) {}

  async monitorNewPools(callback: (signature: string, mints: string[]) => void): Promise<void> {
    await this.blockchainService.listenForProgramLogs(
      new PublicKey(RAYDIUM_LP_PROGRAM_ID),
      'initialize2',
      async (signature: string) => {
        console.log(`🔎 Processing transaction: ${signature}`);
        const mints = await this.getPoolMintsFromTx(signature);
        if (mints) {
          callback(signature, mints);
          console.log('✅ Successfully processed new LP');
        }
      }
    );
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
      console.error('Error tracking liquidity:', error);
    }
  }

  private async getPoolKeys(baseMint: PublicKey, quoteMint: PublicKey) {
    const [poolId] = await PublicKey.findProgramAddress(
      [Buffer.from('Pool'), baseMint.toBuffer(), quoteMint.toBuffer()],
      new PublicKey(RAYDIUM_LP_PROGRAM_ID)
    );
    return { id: poolId };
  }

  private async getPoolMintsFromTx(txId: string): Promise<string[] | undefined> {
    try {
      const tx = await this.blockchainService.getParsedTransaction(txId);
      
      if (!tx?.transaction) {
        console.log(`⚠️ Transaction not found: ${txId}`);
        return;
      }

      const instruction = tx.transaction.message.instructions.find(
        (ix): ix is PartiallyDecodedInstruction => 
          ix.programId.toBase58() === RAYDIUM_LP_PROGRAM_ID &&
          'accounts' in ix
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
      return;
    }
  }
}