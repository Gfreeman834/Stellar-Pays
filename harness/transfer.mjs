import {
  rpc, TransactionBuilder, Operation, Networks, Keypair, Address, xdr,
  hash, nativeToScVal, scValToNative, Contract,
} from '@stellar/stellar-sdk';
import fs from 'fs';

const A = JSON.parse(fs.readFileSync('addresses.json','utf8'));
const emps = JSON.parse(fs.readFileSync('employees.json','utf8'));
const PASS = Networks.TESTNET;
const server = new rpc.Server('https://soroban-testnet.stellar.org');

const SAC = A.usdc_active_sac;
const CORP = A.corporate_account;
const MERCHANT = A.merchant_g;
const VERIFIER = A.verifier;
const AMOUNT = BigInt(process.env.AMOUNT || '30000000');

const admin = Keypair.fromSecret(process.env.ADMIN_SECRET);

const addrScVal = (a) => new Address(a).toScVal();
const i128ScVal = (v) => nativeToScVal(v, { type: 'i128' });

function signerScVal(pubBuf) {
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('External'),
    new Address(VERIFIER).toScVal(),
    xdr.ScVal.scvBytes(pubBuf),
  ]);
}

const run = async () => {
  const adminAcct = await server.getAccount(admin.publicKey());

  // 1) Build the transfer invocation
  const func = xdr.HostFunction.hostFunctionTypeInvokeContract(
    new xdr.InvokeContractArgs({
      contractAddress: new Address(SAC).toScAddress(),
      functionName: 'transfer',
      args: [addrScVal(CORP), addrScVal(MERCHANT), i128ScVal(AMOUNT)],
    })
  );
  const probeTx = new TransactionBuilder(adminAcct, { fee: '2000000', networkPassphrase: PASS })
    .addOperation(Operation.invokeHostFunction({ func, auth: [] }))
    .setTimeout(120).build();

  // 2) Simulate to get the required auth entry
  const sim = await server.simulateTransaction(probeTx);
  if (rpc.Api.isSimulationError(sim)) { console.error('SIM ERROR', sim.error); process.exit(1); }
  const authEntries = sim.result.auth || [];
  console.log('auth entries from sim:', authEntries.length);
  const entry = authEntries.find(e =>
    e.credentials().switch() === xdr.SorobanCredentialsType.sorobanCredentialsAddress() &&
    Address.fromScAddress(e.credentials().address().address()).toString() === CORP
  );
  if (!entry) { console.error('no CORP auth entry found'); process.exit(1); }

  // 3) Set expiration + compute signature_payload
  const latest = await server.getLatestLedger();
  const validUntil = latest.sequence + 100;
  const creds = entry.credentials().address();
  creds.signatureExpirationLedger(validUntil);

  const networkId = hash(Buffer.from(PASS));
  const preimage = xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId,
      nonce: creds.nonce(),
      signatureExpirationLedger: validUntil,
      invocation: entry.rootInvocation(),
    })
  );
  const signaturePayload = hash(preimage.toXDR()); // Hash<32>

  // 4) auth_digest = sha256(signature_payload || xdr(Vec<u32>[0]))
  const ctxRuleIds = xdr.ScVal.scvVec([xdr.ScVal.scvU32(0)]);
  const authDigest = hash(Buffer.concat([signaturePayload, ctxRuleIds.toXDR()]));

  // 5) sign with 2 of 3 employees (threshold = 2)
  const NSIG = parseInt(process.env.NSIG || '2'); const chosen = emps.slice(0, NSIG).map(e => {
    const kp = Keypair.fromSecret(e.secret);
    return { pub: Buffer.from(kp.rawPublicKey()), sig: kp.sign(authDigest) };
  });
  chosen.sort((a, b) => Buffer.compare(a.pub, b.pub)); // ScMap key order

  const signersMap = xdr.ScVal.scvMap(chosen.map(s =>
    new xdr.ScMapEntry({ key: signerScVal(s.pub), val: xdr.ScVal.scvBytes(s.sig) })
  ));
  const authPayload = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('context_rule_ids'), val: ctxRuleIds }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('signers'), val: signersMap }),
  ]);
  creds.signature(authPayload);

  // 6) Rebuild op with the signed entry, assemble (fee + sorobanData), sign by admin (facilitator pays = gasless for CORP)
  const adminAcct2 = await server.getAccount(admin.publicKey());
  const finalRaw = new TransactionBuilder(adminAcct2, { fee: '5000000', networkPassphrase: PASS })
    .addOperation(Operation.invokeHostFunction({ func, auth: [entry] }))
    .setTimeout(120).build();
  // Re-simulate WITH signed auth so resources include multisig verify + policy cost
  const sim2 = await server.simulateTransaction(finalRaw);
  if (rpc.Api.isSimulationError(sim2)) { console.error('SIM2 ERROR', sim2.error); process.exit(1); }
  const assembled = rpc.assembleTransaction(finalRaw, sim2).build();
  assembled.sign(admin);

  const send = await server.sendTransaction(assembled);
  console.log('sent:', send.hash, send.status);
  let res = await server.getTransaction(send.hash);
  for (let i = 0; i < 30 && res.status === 'NOT_FOUND'; i++) {
    await new Promise(r => setTimeout(r, 2000));
    res = await server.getTransaction(send.hash);
  }
  console.log('final status:', res.status);
  if (res.status !== 'SUCCESS') {
    console.error('FAILED', JSON.stringify(res.resultXdr?.toXDR?.('base64') || res, null, 2));
    process.exit(1);
  }
  console.log('TRANSFER TX:', send.hash);
  fs.writeFileSync('last-transfer.json', JSON.stringify({ tx: send.hash, amount: AMOUNT.toString(), validUntil }, null, 2));
};
run().catch(e => { console.error(e); process.exit(1); });
