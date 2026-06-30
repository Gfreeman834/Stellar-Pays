extern crate std;

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

use crate::contract::{PaymentRegistry, PaymentRegistryClient};

fn setup(e: &Env) -> (PaymentRegistryClient<'static>, Address, Address) {
    let admin = Address::generate(e);
    let recorder = Address::generate(e);
    let id = e.register(PaymentRegistry, (admin.clone(), recorder.clone()));
    (PaymentRegistryClient::new(e, &id), admin, recorder)
}

#[test]
fn records_payment_and_accumulates_total() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin, recorder) = setup(&e);

    let payer = Address::generate(&e);
    let merchant = Address::generate(&e);
    let token = Address::generate(&e);
    // Distinct settlement references: each maps to a separate on-chain tx.
    let reference_a = BytesN::from_array(&e, &[7u8; 32]);
    let reference_b = BytesN::from_array(&e, &[8u8; 32]);

    assert_eq!(client.payment_count(), 0);
    assert_eq!(client.recorder(), recorder);

    client.record_payment(&payer, &merchant, &token, &2_000_000, &reference_a);
    client.record_payment(&payer, &merchant, &token, &500_000, &reference_b);

    assert_eq!(client.payment_count(), 2);
    assert_eq!(client.total_paid(&payer), 2_500_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn rejects_duplicate_reference() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin, _recorder) = setup(&e);

    let payer = Address::generate(&e);
    let merchant = Address::generate(&e);
    let token = Address::generate(&e);
    let reference = BytesN::from_array(&e, &[42u8; 32]);

    // First record with this reference succeeds.
    client.record_payment(&payer, &merchant, &token, &1_000_000, &reference);
    // A retry with the same reference must be rejected (AlreadyRecorded = 4),
    // so Count and TotalPaid are not double-counted.
    client.record_payment(&payer, &merchant, &token, &1_000_000, &reference);
}

#[test]
fn distinct_references_accumulate() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin, _recorder) = setup(&e);

    let payer = Address::generate(&e);
    let merchant = Address::generate(&e);
    let token = Address::generate(&e);

    client.record_payment(&payer, &merchant, &token, &1_000_000, &BytesN::from_array(&e, &[1u8; 32]));
    client.record_payment(&payer, &merchant, &token, &1_000_000, &BytesN::from_array(&e, &[2u8; 32]));

    assert_eq!(client.payment_count(), 2);
    assert_eq!(client.total_paid(&payer), 2_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn rejects_non_positive_amount() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin, _recorder) = setup(&e);

    let payer = Address::generate(&e);
    let merchant = Address::generate(&e);
    let token = Address::generate(&e);
    let reference = BytesN::from_array(&e, &[0u8; 32]);

    client.record_payment(&payer, &merchant, &token, &0, &reference);
}
