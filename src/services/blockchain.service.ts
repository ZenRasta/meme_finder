import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { RAYDIUM_LP_PROGRAM_ID } from '../config/constants';

export class BlockchainService {
  constructor(private connection: Connection) {}

  async listenForProgramLogs(
    programId: PublicKey,
    instructionName: string,
    callback: (signature: string) => void
  ) {
    this.connection.onLogs(
      programId,
      ({ logs, err, signature }) => {
        if (err || !logs) return;
        if (logs.some(log => log.includes(instructionName))) {
          callback(signature);
        }
      },
      'finalized'
    );
  }

  async getParsedTransaction(txId: string): Promise<ParsedTransactionWithMeta | null> {
    return this.connection.getParsedTransaction(txId, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });
  }
}
