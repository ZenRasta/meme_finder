// src/services/blockchain.service.ts
import { 
    Connection, 
    PublicKey, 
    ParsedTransactionWithMeta, 
    SignaturesForAddressOptions,
    ConfirmedSignatureInfo,
    Finality,
    Commitment
  } from '@solana/web3.js';
  import { DateRange } from '../config/time';
  
  export class BlockchainService {
    private readonly BATCH_SIZE = 25;
    private readonly REQUEST_DELAY = 2000;
    private readonly MAX_RETRIES = 3;
    private readonly COMMITMENT: Finality = 'finalized';
  
    constructor(private connection: Connection) {}
  
    async listenForProgramLogs(
      programId: PublicKey,
      instructionName: string,
      callback: (signature: string) => void
    ): Promise<void> {
      this.connection.onLogs(
        programId,
        ({ logs, err, signature }) => {
          if (err || !logs) return;
          if (logs.some(log => log.includes(instructionName))) {
            callback(signature);
          }
        },
        this.COMMITMENT as Commitment // Type assertion for compatible usage
      );
    }
  
    async getParsedTransaction(txId: string): Promise<ParsedTransactionWithMeta | null> {
      try {
        return await this.connection.getParsedTransaction(txId, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });
      } catch (error) {
        console.error(`Error fetching transaction ${txId}:`, error);
        return null;
      }
    }
  
    async getHistoricalTransactions(
      programId: PublicKey,
      dateRange: DateRange
    ): Promise<string[]> {
      try {
        console.log(`Fetching transactions between ${dateRange.start} and ${dateRange.end}`);
        
        let allSignatures: ConfirmedSignatureInfo[] = [];
        let lastSignature: string | undefined;
        let retryCount = 0;
  
        while (true) {
          const options: SignaturesForAddressOptions = {
            limit: this.BATCH_SIZE,
            before: lastSignature
          };
  
          try {
            const batch = await this.connection.getSignaturesForAddress(
              programId,
              options,
              this.COMMITMENT // Correct Finality type
            );
            
            if (!batch || batch.length === 0) break;
  
            lastSignature = batch[batch.length - 1].signature;
            retryCount = 0;
  
            const filtered = batch.filter(sig => 
              sig.blockTime && 
              new Date(sig.blockTime * 1000) >= dateRange.start &&
              new Date(sig.blockTime * 1000) <= dateRange.end
            );
  
            allSignatures = [...allSignatures, ...filtered];
            console.log(`Processed batch: ${filtered.length}/${batch.length} relevant`);
  
            if (batch.length < this.BATCH_SIZE) break;
  
            await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));
  
          } catch (error) {
            if (retryCount < this.MAX_RETRIES) {
              retryCount++;
              const delay = this.REQUEST_DELAY * Math.pow(2, retryCount);
              console.log(`Retry ${retryCount}/${this.MAX_RETRIES} in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            throw new Error(`Failed after ${this.MAX_RETRIES} retries: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
  
        console.log(`Found ${allSignatures.length} total transactions in date range`);
        return allSignatures.map(sig => sig.signature);
  
      } catch (error) {
        console.error('Historical transaction fetch failed:', error);
        throw error;
      }
    }
  
    async getTransactionsWithDelay(
      signatures: string[], 
      delayMs = 2000
    ): Promise<Array<ParsedTransactionWithMeta | null>> {
      const results: Array<ParsedTransactionWithMeta | null> = [];
      for (const signature of signatures) {
        try {
          const tx = await this.getParsedTransaction(signature);
          results.push(tx);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } catch (error) {
          console.error(`Error processing ${signature}:`, error);
          results.push(null);
        }
      }
      return results;
    }
  }
  