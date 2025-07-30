import sha256 from 'crypto-js/sha256.js';
import pkg from 'elliptic';
const { ec: EC } = pkg;
const ec = new EC('secp256k1');


class Transaction{
    constructor(fromAddress, toAddress, amount, timestamp = null){
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.timestamp = timestamp || new Date().toISOString();
    }

    calculateHash(){
        return sha256(this.fromAddress + this.toAddress + this.amount + this.timestamp).toString();
    }

    signTransaction(signingKey){
        if(signingKey.getPublic('hex') !== this.fromAddress){
            throw new Error('You cannot sign transactions for other wallets!');
        }

        const hashTx = this.calculateHash();
        const sig = signingKey.sign(hashTx, 'base64');
        this.signature = sig.toDER('hex');
    }

    isValid(){
        if(this.fromAddress === null) return true;
        // Allow system/faucet transactions without signature
        if(this.fromAddress === 'meowcoin-faucet' || (typeof process !== 'undefined' && process.env && this.fromAddress === process.env.SYSTEM_USER_PUBLIC_KEY)) return true;
        if(!this.signature || this.signature.length === 0){
            throw new Error('No signature in this transaction');
        }
        const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
        return publicKey.verify(this.calculateHash(), this.signature);
    }
}


class Block{
    constructor(timestamp, transactions, previousHash = ''){
        this.timestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
        this.nonce = 0;
    }

    calculateHash(){
        return sha256(this.timestamp + this.previousHash + JSON.stringify(this.transactions) + this.nonce).toString();
    }

    mineBlock(difficulty){
        while(this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")){
            this.nonce++;
            this.hash = this.calculateHash();
        }
        
        console.log("Block mined: " + this.hash);
    }

    hasValidTransaction(){
        for(const tx of this.transactions){
            if(!tx.isValid()){
                return false;
            }
        }

        return true;
    }
}

class Blockchain{
    constructor(){
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2;
        this.pendingTransactions = [];
        this.miningReward = 100;
    }

    createGenesisBlock(){
        return new Block("01/01/2025", "Genesis block", "0");
    }

    getLatestBlock(){
        return this.chain[this.chain.length - 1];
    }

    minePendingTransactions(miningRewardAddress) {
        let block = new Block(new Date().toISOString(), this.pendingTransactions, this.getLatestBlock().hash);
        block.mineBlock(this.difficulty);

        console.log('Block successfully mined!');
        this.chain.push(block);

        this.pendingTransactions = [
            new Transaction(null, miningRewardAddress, this.miningReward)
        ];
    }

    addTransaction(transaction){

        if(!transaction.fromAddress || !transaction.toAddress){
            throw new Error('Transaction must include from and to address');
        }

        if(!transaction.isValid()){
            throw new Error('Cannot add invalid transaction to chain');
        }

        this.pendingTransactions.push(transaction);
    }

    getBalanceOfAddress(address){
        let balance = 0;

        for(const block of this.chain){
            for(const trans of block.transactions){
                if(trans.fromAddress === address){
                    balance -= trans.amount;
                }

                if(trans.toAddress === address){
                    balance += trans.amount;
                }
            }
        }

        return balance;
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (!currentBlock.hasValidTransaction()) {
                console.log('Invalid transactions in block', i);
                return false;
            }

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                console.log('Invalid hash at block', i);
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                console.log('Invalid previous hash at block', i);
                return false;
            }
        }

        return true;
    }
}

export { Blockchain, Transaction };