import { PublicKey } from '@solana/web3.js';
import { LIQUIDITY_STATE_LAYOUT_V4 } from '@raydium-io/raydium-sdk';

export async function getPoolKeys(
  baseMint: PublicKey,
  quoteMint: PublicKey
) {
  const [poolId] = await PublicKey.findProgramAddress(
    [
      Buffer.from('Pool'),
      baseMint.toBuffer(),
      quoteMint.toBuffer(),
    ],
    new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8') // Raydium Program ID
  );

  return {
    id: poolId,
    baseMint,
    quoteMint,
    programId: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')
  };
}
