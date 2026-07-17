import json

from conftest import CANDLE_START, create_market, fund_both_sides, mock_sources, warp


def test_regular_user_cannot_settle(direct_vm, market_contract, direct_owner, direct_alice):
    direct_vm.sender = direct_owner
    create_market(market_contract)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Unauthorized settlement caller"):
        market_contract.settle_market(0)


def test_owner_can_settle_and_timing_is_still_enforced(direct_vm, market_contract, direct_owner, direct_alice):
    direct_vm.sender = direct_owner
    create_market(market_contract)
    direct_vm.sender = direct_alice
    direct_vm.value = 10**18
    market_contract.place_bet(0, "UP")
    direct_vm.value = 0
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("Settlement attempted too early"):
        market_contract.settle_market(0)
    warp(direct_vm, "2026-01-01T02:02:00Z")
    market_contract.settle_market(0)
    assert json.loads(market_contract.get_market(0))["status"] == "CANCELLED"


def test_operator_can_create_and_settle_but_cannot_replace_operator(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    direct_vm.sender = direct_owner
    market_contract.set_market_operator(str(direct_alice))
    direct_vm.sender = direct_alice
    assert market_contract.create_market("BTC", CANDLE_START) == 0
    with direct_vm.expect_revert("Only owner"):
        market_contract.set_market_operator(str(direct_bob))
    direct_vm.sender = direct_bob
    direct_vm.value = 10**18
    market_contract.place_bet(0, "UP")
    direct_vm.value = 0
    warp(direct_vm, "2026-01-01T02:02:00Z")
    direct_vm.sender = direct_alice
    market_contract.settle_market(0)
    assert json.loads(market_contract.get_market(0))["status"] == "CANCELLED"


def test_authorized_settlement_still_uses_five_source_consensus(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    direct_vm.sender = direct_owner
    create_market(market_contract)
    fund_both_sides(direct_vm, market_contract, direct_alice, direct_bob)
    mock_sources(direct_vm)
    warp(direct_vm, "2026-01-01T02:02:00Z")
    direct_vm.sender = direct_owner
    market_contract.settle_market(0)
    market = json.loads(market_contract.get_market(0))
    assert market["final_outcome"] == "UP"
    assert market["settlement"]["valid_source_count"] == 5
    assert set(market["settlement"]["sources"]) == {"BINANCE", "BYBIT", "GATEIO", "MEXC", "BITGET"}
