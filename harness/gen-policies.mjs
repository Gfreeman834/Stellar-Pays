import fs from 'fs';
const A = JSON.parse(fs.readFileSync('addresses.json','utf8'));

// Soroban struct -> ScVal::Map with Symbol keys, sorted lexicographically by key.
const thresholdVal = { map: [
  { key: { symbol: "threshold" }, val: { u32: 2 } }
]};
const spendVal = { map: [
  { key: { symbol: "period_ledgers" }, val: { u32: 17280 } },
  { key: { symbol: "spending_limit" }, val: { i128: "50000000" } }
]};

// outer Map<Address, Val>: object keyed by contract address
const policies = {
  [A.threshold_policy]: thresholdVal,
  [A.spending_limit_policy]: spendVal
};
fs.writeFileSync('policies.json', JSON.stringify(policies));
console.log(JSON.stringify(policies,null,1));
