extern crate std;

use soroban_sdk::Env;

use crate::contract::CorporateAccount;

// FAZ 3 (vertical slice) fills these in: deploy the ed25519 verifier + threshold
// + spending-limit policy contracts, construct a CorporateAccount referencing
// them, then assert a SEP-41 transfer is authorized only when the multisig
// threshold is met and the spending limit is respected.
//
// Setup pattern (from stellar-contracts CLAUDE.md): Env::default(),
// Address::generate(&e), e.register(CorporateAccount, (signers, policies)),
// e.mock_all_auths().

#[test]
#[ignore = "FAZ 3: requires deployed verifier + policy contracts"]
fn multisig_transfer_authorizes_at_threshold() {
    let _e = Env::default();
    let _ = CorporateAccount;
    // TODO(FAZ3): full end-to-end multisig + spending-limit authorization test.
}
