//! # PayRoute Payment Registry (off-path audit)
//!
//! An audit trail and dApp/merchant registry that sits OFF the x402 payment
//! path. The canonical "Built on Stellar" x402 facilitator only settles a
//! direct SEP-41 `transfer` and rejects sub-invocations, so the corporate
//! account cannot route through this contract during settlement. Instead, the
//! PayRoute backend records each settled payment here in a separate, recorder
//! authorized transaction, producing an immutable corporate accounting record
//! keyed by payer.
//!
//! Conventions follow the OpenZeppelin stellar-contracts guide: `#[contracterror]`
//! enum, `#[contractevent]` + emit helper, persistent-read TTL extension.
use soroban_sdk::{
    contract, contractevent, contractimpl, contracterror, contracttype, panic_with_error,
    Address, BytesN, Env,
};

// ################## CONSTANTS ##################

const DAY_IN_LEDGERS: u32 = 17280;
pub const REGISTRY_EXTEND_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const REGISTRY_TTL_THRESHOLD: u32 = REGISTRY_EXTEND_AMOUNT - DAY_IN_LEDGERS;

// ################## ERRORS ##################

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RegistryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NonPositiveAmount = 3,
    AlreadyRecorded = 4,
}

// ################## STORAGE ##################

#[contracttype]
pub enum DataKey {
    Admin,
    Recorder,
    Count,
    TotalPaid(Address),    // payer -> cumulative amount recorded
    Recorded(BytesN<32>),  // settlement reference -> already recorded (dedup guard)
}

// ################## EVENTS ##################

/// Emitted when a settled x402 payment is recorded in the registry.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaymentRecorded {
    #[topic]
    pub payer: Address,
    #[topic]
    pub merchant: Address,
    pub token: Address,
    pub amount: i128,
    pub reference: BytesN<32>,
}

fn emit_payment_recorded(
    e: &Env,
    payer: &Address,
    merchant: &Address,
    token: &Address,
    amount: i128,
    reference: &BytesN<32>,
) {
    PaymentRecorded {
        payer: payer.clone(),
        merchant: merchant.clone(),
        token: token.clone(),
        amount,
        reference: reference.clone(),
    }
    .publish(e);
}

// ################## CONTRACT ##################

#[contract]
pub struct PaymentRegistry;

#[contractimpl]
impl PaymentRegistry {
    /// Initialize the registry.
    ///
    /// * `admin` - can rotate the recorder address.
    /// * `recorder` - the PayRoute backend address authorized to record
    ///   settled payments (typically the facilitator/relayer operator key).
    pub fn __constructor(e: &Env, admin: Address, recorder: Address) {
        let store = e.storage().instance();
        if store.has(&DataKey::Admin) {
            panic_with_error!(e, RegistryError::AlreadyInitialized);
        }
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Recorder, &recorder);
        store.set(&DataKey::Count, &0u32);
    }

    /// Record a settled payment. Recorder-authorized.
    ///
    /// `reference` is the settlement tx hash (or other unique id) so the record
    /// links back to the on-chain transaction the facilitator submitted.
    pub fn record_payment(
        e: &Env,
        payer: Address,
        merchant: Address,
        token: Address,
        amount: i128,
        reference: BytesN<32>,
    ) {
        if amount <= 0 {
            panic_with_error!(e, RegistryError::NonPositiveAmount);
        }
        Self::recorder(e).require_auth();

        // Dedup guard: a settlement `reference` (tx hash) must be recorded at
        // most once. Without this, a recorder retry would double-count the
        // payment in `Count` and `TotalPaid`, silently inflating the audit
        // trail. We persist the reference and reject any repeat.
        let recorded_key = DataKey::Recorded(reference.clone());
        if e.storage().persistent().has(&recorded_key) {
            panic_with_error!(e, RegistryError::AlreadyRecorded);
        }
        e.storage().persistent().set(&recorded_key, &true);
        e.storage().persistent().extend_ttl(
            &recorded_key,
            REGISTRY_TTL_THRESHOLD,
            REGISTRY_EXTEND_AMOUNT,
        );

        let count: u32 = e.storage().instance().get(&DataKey::Count).unwrap_or(0);
        e.storage().instance().set(&DataKey::Count, &(count + 1));

        let key = DataKey::TotalPaid(payer.clone());
        let prev: i128 = if e.storage().persistent().has(&key) {
            e.storage().persistent().extend_ttl(
                &key,
                REGISTRY_TTL_THRESHOLD,
                REGISTRY_EXTEND_AMOUNT,
            );
            e.storage().persistent().get(&key).unwrap_or(0)
        } else {
            0
        };
        e.storage().persistent().set(&key, &(prev + amount));

        emit_payment_recorded(e, &payer, &merchant, &token, amount, &reference);
    }

    /// Rotate the recorder address. Admin-authorized.
    pub fn set_recorder(e: &Env, new_recorder: Address) {
        Self::admin(e).require_auth();
        e.storage().instance().set(&DataKey::Recorder, &new_recorder);
    }

    // ################## QUERY STATE ##################

    pub fn admin(e: &Env) -> Address {
        e.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(e, RegistryError::NotInitialized))
    }

    pub fn recorder(e: &Env) -> Address {
        e.storage()
            .instance()
            .get(&DataKey::Recorder)
            .unwrap_or_else(|| panic_with_error!(e, RegistryError::NotInitialized))
    }

    pub fn payment_count(e: &Env) -> u32 {
        e.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    pub fn total_paid(e: &Env, payer: Address) -> i128 {
        let key = DataKey::TotalPaid(payer);
        if e.storage().persistent().has(&key) {
            e.storage().persistent().extend_ttl(
                &key,
                REGISTRY_TTL_THRESHOLD,
                REGISTRY_EXTEND_AMOUNT,
            );
            e.storage().persistent().get(&key).unwrap_or(0)
        } else {
            0
        }
    }
}
