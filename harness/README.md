# PayRoute Stellar testnet harness

Reproduces the FAZ 3 milestone: gasless 2-of-3 multisig USDC payment from the
corporate Smart Account, enforced by OZ threshold + spending-limit policies,
recorded off-path in the payment_registry.

## Files
- `addresses.json`  all deployed contract IDs + keys (testnet)
- `gen-args.mjs`     generates 3 employee ed25519 signers + `employees.json` + `signers.json`
- `gen-policies.mjs` generates policies.json (tagged ScVal Map<Address,Val>)
- `transfer.mjs`     builds + signs the multisig AuthPayload, fee-paid by the
                     facilitator (admin) so the corporate account stays gasless
- `employees.json`   SECRET KEYS of the 3 demo signers (testnet only, **git-ignored**)
- `signers.json`     `Vec<Signer::External>` for the account constructor (**git-ignored**)
- `employees.example.json`, `signers.example.json`  committed shape templates

## Generating local keys

`employees.json` and `signers.json` are **not committed** (they hold secret
seeds). Generate them locally before running the harness:

```
cd harness
npm install
node gen-args.mjs        # writes employees.json, signers.json, policies.json
```

This mints three fresh random testnet ed25519 keypairs each run. The signers
only sign the auth digest, so they do not need funding; only the admin /
facilitator key (the tx source + fee payer) must be funded via friendbot:

```
stellar keys generate payroute-admin --network testnet --fund
```

> ⚠️ **SECURITY:** the seeds these scripts produce are throwaway **testnet**
> keys. Any seed that was ever committed to git is **compromised** — never reuse
> it. **Never use any of these seeds, or this harness, on Stellar mainnet.**

## Run a transfer
```
export ADMIN_SECRET=$(stellar keys secret payroute-admin)
AMOUNT=30000000 NSIG=2 node transfer.mjs   # 3 USDC, 2 signers -> SUCCESS
AMOUNT=60000000 NSIG=2 node transfer.mjs   # 6 USDC          -> 3221 SpendingLimitExceeded
AMOUNT=10000000 NSIG=1 node transfer.mjs   # 1 signer        -> 3202 threshold not met
```

## AuthPayload signing recipe (verified vs stellar-accounts 0.7.1)
1. simulate transfer -> get the CORP SorobanAuthorizationEntry (Address creds)
2. set signatureExpirationLedger; build HashIdPreimage.SorobanAuthorization,
   sha256 -> signature_payload (Hash<32>)
3. auth_digest = sha256( signature_payload_bytes || xdr(ScVec[ScU32(0)]) )
   (context_rule_ids = [0]; storage.rs do_check_auth lines 493-495)
4. each ed25519 signer signs auth_digest (raw 32 bytes); verifier does ed25519_verify
5. AuthPayload = { context_rule_ids: Vec[0], signers: Map<Signer,Bytes> }
   Signer::External(verifier, pubkey) -> ScVec[Symbol("External"), Address, Bytes]
   Map keys sorted by pubkey bytes; struct keys sorted (context_rule_ids < signers)
6. set creds.signature = AuthPayload; re-simulate WITH signed auth (so resources
   include verify+enforce cost, else ResourceLimitExceeded); assemble; admin signs+pays
