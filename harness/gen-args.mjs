import { Keypair } from '@stellar/stellar-sdk';
import fs from 'fs';

const A = JSON.parse(fs.readFileSync('addresses.json','utf8'));

// 3 employee ed25519 signers (Stellar keypairs == ed25519)
const emps = [0,1,2].map(()=>Keypair.random());
const empOut = emps.map(k=>({ public: k.publicKey(), secret: k.secret(), hex: Buffer.from(k.rawPublicKey()).toString('hex') }));
fs.writeFileSync('employees.json', JSON.stringify(empOut,null,2));

// signers: Vec<Signer::External(verifier, BytesN32 pubkey hex)>
const signers = emps.map(k=>({ External: [ A.verifier, Buffer.from(k.rawPublicKey()).toString('hex') ] }));
fs.writeFileSync('signers.json', JSON.stringify(signers));

// policies: Map<Address, Val>
//  threshold policy -> SimpleThresholdAccountParams { threshold: u32 }
//  spending-limit   -> SpendingLimitAccountParams { spending_limit: i128, period_ledgers: u32 }
const policies = {
  [A.threshold_policy]: { threshold: 2 },
  [A.spending_limit_policy]: { spending_limit: "50000000", period_ledgers: 17280 }
};
fs.writeFileSync('policies.json', JSON.stringify(policies));

console.log('employees:', empOut.map(e=>e.public).join(', '));
console.log('signers.json:', JSON.stringify(signers));
console.log('policies.json:', JSON.stringify(policies));
