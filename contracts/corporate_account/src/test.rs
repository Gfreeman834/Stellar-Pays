extern crate std;

use soroban_sdk::{
    auth::{Context, ContractContext},
    contract, contractimpl, symbol_short,
    testutils::Address as _,
    Address, Bytes, Env, IntoVal, Map, Val, Vec,
};

use stellar_accounts::{
    policies::{
        simple_threshold::{self, SimpleThresholdAccountParams},
        spending_limit::{self, SpendingLimitAccountParams},
        Policy,
    },
    smart_account::{do_check_auth, AuthPayload, ContextRule, Signer},
};

use crate::contract::CorporateAccount;

// These tests mirror the deployed PayRoute corporate account (see
// deployments/testnet.json): a 2-of-3 multisig threshold policy plus a 5 USDC
// (50_000_000 stroops, 7 decimals) per-period spending-limit policy, scoped to
// the USDC token via a `CallContract(target)` context rule.
//
// Production authenticates employees with the ed25519 verifier (External
// signers), and the on-chain path is reproduced end-to-end by
// `harness/transfer.mjs`. Here we authenticate with `Signer::Delegated` under
// `mock_all_auths` — the crate's own integration-test pattern — because the
// scenarios under test are the *policy* outcomes (threshold + spending limit),
// which are driven by the set of authenticated signers and the transfer
// amount, not by the signature-verification plumbing.

const THRESHOLD: u32 = 2;
const PERIOD_LEDGERS: u32 = 17280;
const SPENDING_LIMIT: i128 = 50_000_000; // 5 USDC at 7 decimals

// ---- In-test policy contracts: thin wrappers over the reusable OpenZeppelin
// policy library modules, exactly as the `multisig-smart-account` example
// contracts wrap them. ----

#[contract]
struct ThresholdPolicy;

#[contractimpl]
impl Policy for ThresholdPolicy {
    type AccountParams = SimpleThresholdAccountParams;

    fn enforce(
        e: &Env,
        context: Context,
        authenticated_signers: Vec<Signer>,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        simple_threshold::enforce(e, &context, &authenticated_signers, &context_rule, &smart_account);
    }

    fn install(
        e: &Env,
        install_params: Self::AccountParams,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        simple_threshold::install(e, &install_params, &context_rule, &smart_account);
    }

    fn uninstall(e: &Env, context_rule: ContextRule, smart_account: Address) {
        simple_threshold::uninstall(e, &context_rule, &smart_account);
    }
}

#[contract]
struct SpendingLimitPolicy;

#[contractimpl]
impl Policy for SpendingLimitPolicy {
    type AccountParams = SpendingLimitAccountParams;

    fn enforce(
        e: &Env,
        context: Context,
        authenticated_signers: Vec<Signer>,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        spending_limit::enforce(e, &context, &authenticated_signers, &context_rule, &smart_account);
    }

    fn install(
        e: &Env,
        install_params: Self::AccountParams,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        spending_limit::install(e, &install_params, &context_rule, &smart_account);
    }

    fn uninstall(e: &Env, context_rule: ContextRule, smart_account: Address) {
        spending_limit::uninstall(e, &context_rule, &smart_account);
    }
}

struct Fixture {
    e: Env,
    account: Address,
    target: Address,
    signers: std::vec::Vec<Address>,
}

/// Deploy the threshold + spending-limit policies and a CorporateAccount that
/// references them, wired identically to the testnet deployment.
fn setup() -> Fixture {
    let e = Env::default();
    e.mock_all_auths();

    let target = Address::generate(&e); // stands in for the USDC SAC

    // Three employee/delegate signers (2-of-3 multisig).
    let s1 = Address::generate(&e);
    let s2 = Address::generate(&e);
    let s3 = Address::generate(&e);
    let signers = Vec::from_array(
        &e,
        [
            Signer::Delegated(s1.clone()),
            Signer::Delegated(s2.clone()),
            Signer::Delegated(s3.clone()),
        ],
    );

    let threshold_policy = e.register(ThresholdPolicy, ());
    let spending_policy = e.register(SpendingLimitPolicy, ());

    let mut policies: Map<Address, Val> = Map::new(&e);
    policies.set(
        threshold_policy,
        SimpleThresholdAccountParams { threshold: THRESHOLD }.into_val(&e),
    );
    policies.set(
        spending_policy,
        SpendingLimitAccountParams {
            spending_limit: SPENDING_LIMIT,
            period_ledgers: PERIOD_LEDGERS,
        }
        .into_val(&e),
    );

    let account = e.register(CorporateAccount, (signers, policies, target.clone()));

    Fixture { e, account, target, signers: std::vec![s1, s2, s3] }
}

/// Build a SEP-41 `transfer(from, to, amount)` auth context scoped to `target`,
/// matching the account's `CallContract(target)` context rule.
fn transfer_context(e: &Env, target: &Address, from: &Address, to: &Address, amount: i128) -> Context {
    let mut args = Vec::new(e);
    args.push_back(from.into_val(e));
    args.push_back(to.into_val(e));
    args.push_back(amount.into_val(e));
    Context::Contract(ContractContext {
        contract: target.clone(),
        fn_name: symbol_short!("transfer"),
        args,
    })
}

/// Assemble the AuthPayload for the single CallContract rule (id 0), listing
/// `num_signers` of the account's delegated signers as authenticated.
fn auth_payload(e: &Env, fx: &Fixture, num_signers: usize) -> AuthPayload {
    let mut signature_map = Map::new(e);
    for addr in fx.signers.iter().take(num_signers) {
        signature_map.set(Signer::Delegated(addr.clone()), Bytes::new(e));
    }
    AuthPayload {
        signers: signature_map,
        context_rule_ids: Vec::from_array(e, [0u32]),
    }
}

fn run_check_auth(fx: &Fixture, num_signers: usize, amount: i128) {
    let e = &fx.e;
    let from = fx.account.clone();
    let to = Address::generate(e);
    let context = transfer_context(e, &fx.target, &from, &to, amount);
    let auth_contexts = Vec::from_array(e, [context]);
    let signatures = auth_payload(e, fx, num_signers);
    let payload = Bytes::from_array(e, &[1u8; 32]);

    e.as_contract(&fx.account, || {
        do_check_auth(e, &e.crypto().sha256(&payload), &signatures, &auth_contexts)
            .expect("auth should succeed");
    });
}

#[test]
fn multisig_transfer_authorizes_at_threshold() {
    // 2 of 3 signers, 3 USDC (under the 5 USDC limit) -> authorized.
    let fx = setup();
    run_check_auth(&fx, 2, 30_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #3202)")]
fn rejects_when_threshold_not_met() {
    // Only 1 of 3 signers authenticated, threshold is 2 -> #3202.
    let fx = setup();
    run_check_auth(&fx, 1, 30_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #3221)")]
fn rejects_when_spending_limit_exceeded() {
    // Threshold met (2 signers) but 6 USDC > 5 USDC limit -> #3221.
    let fx = setup();
    run_check_auth(&fx, 2, 60_000_000);
}
