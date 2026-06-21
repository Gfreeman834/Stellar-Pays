//! # PayRoute Corporate Account
//!
//! The corporate treasury wallet, implemented as a Soroban smart account.
//! This contract is the `payer` in an x402 payment: when an x402 payment is a
//! direct SEP-41 `transfer(from = this_account, to = merchant, amount)`, the
//! transfer's `require_auth` triggers this account's `__check_auth`, which runs
//! the configured signers and policies (multisig threshold + spending limit).
//!
//! Gasless settlement is handled off this contract: the OpenZeppelin Relayer
//! x402 facilitator fee-bumps and submits the transaction, so the corporate
//! account never needs to hold XLM for fees.
//!
//! ## Attribution
//!
//! The wiring follows the OpenZeppelin `multisig-smart-account` example
//! (stellar-contracts, MIT). Verified against:
//! `examples/multisig-smart-account/account/src/contract.rs`.
//!
//! ## Composition
//!
//! A deployed corporate account references three other deployed contracts by
//! address, passed in at construction via `signers` and `policies`:
//!   - an ed25519 verifier contract (validates employee/delegate signatures)
//!   - a threshold policy contract (M-of-N multisig)
//!   - a spending-limit policy contract (per-period cap)
//! These are the reusable OpenZeppelin policy/verifier contracts; PayRoute
//! deploys them once and points every corporate account at them.
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contractimpl,
    crypto::Hash,
    Address, BytesN, Env, Map, String, Symbol, Val, Vec,
};
use stellar_accounts::smart_account::{
    self, AuthPayload, ContextRule, ContextRuleType, ExecutionEntryPoint, Signer, SmartAccount,
    SmartAccountError,
};
use stellar_contract_utils::upgradeable::{self as upgradeable, Upgradeable};

#[contract]
pub struct CorporateAccount;

#[contractimpl]
impl CorporateAccount {
    /// Initialize the corporate account with its default context rule.
    ///
    /// # Arguments
    ///
    /// * `signers` - Delegated or external signers (employee/delegate keys via
    ///   the ed25519 verifier) that can authorize payments.
    /// * `policies` - Map of policy contract address -> install parameters.
    ///   PayRoute installs a threshold policy (multisig) and a spending-limit
    ///   policy here.
    /// * `target` - The token contract this account's payments are scoped to
    ///   (the USDC SEP-41 contract). The default context rule is a
    ///   `CallContract(target)` rule so every USDC transfer from this account
    ///   must satisfy the multisig threshold and the per-period spending limit.
    ///   The spending-limit policy requires a `CallContract` rule (it pins the
    ///   limit to one token); `Default` is rejected.
    pub fn __constructor(
        e: &Env,
        signers: Vec<Signer>,
        policies: Map<Address, Val>,
        target: Address,
    ) {
        smart_account::add_context_rule(
            e,
            &ContextRuleType::CallContract(target),
            &String::from_str(e, "payroute-corporate"),
            None,
            &signers,
            &policies,
        );
    }

    /// Add several signers (e.g. onboard new employee delegates) to a rule.
    /// Self-authorized: requires the account's own multisig approval.
    pub fn batch_add_signer(e: &Env, context_rule_id: u32, signers: Vec<Signer>) {
        e.current_contract_address().require_auth();
        smart_account::batch_add_signer(e, context_rule_id, &signers);
    }
}

#[contractimpl]
impl CustomAccountInterface for CorporateAccount {
    type Error = SmartAccountError;
    type Signature = AuthPayload;

    /// Authorization entry point invoked by the Soroban host on `require_auth`.
    /// Delegates to the smart-account engine, which validates signatures
    /// against the context rules and enforces all installed policies.
    fn __check_auth(
        e: Env,
        signature_payload: Hash<32>,
        signatures: AuthPayload,
        auth_contexts: Vec<Context>,
    ) -> Result<(), Self::Error> {
        smart_account::do_check_auth(&e, &signature_payload, &signatures, &auth_contexts)
    }
}

#[contractimpl(contracttrait)]
impl SmartAccount for CorporateAccount {}

#[contractimpl(contracttrait)]
impl ExecutionEntryPoint for CorporateAccount {}

#[contractimpl]
impl Upgradeable for CorporateAccount {
    fn upgrade(e: &Env, new_wasm_hash: BytesN<32>, _operator: Address) {
        e.current_contract_address().require_auth();
        upgradeable::upgrade(e, &new_wasm_hash);
    }
}
