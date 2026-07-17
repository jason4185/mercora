import json

import pytest

from conftest import CANDLE_END, CANDLE_START, GEN, NOW, SETTLE_AFTER, bet, create_market, warp


def test_owner_can_create_and_fields_are_derived(direct_vm, market_contract, direct_owner):
    direct_vm.sender = direct_owner
    assert create_market(market_contract) == 0
    market = json.loads(market_contract.get_market(0))
    assert market["market_key"] == f"BTC:1H:{CANDLE_START}"
    assert market["pair"] == "BTCUSDT"
    assert market["market_type"] == "ONE_HOUR_DIRECTION"
    assert market["candle_end"] == str(CANDLE_END)
    assert market["betting_close"] == str(CANDLE_START)
    assert market["settle_after"] == str(SETTLE_AFTER)
    assert market["question"] == "Will BTCUSDT close higher than it opened between 1 January 2026 01:00 and 1 January 2026 02:00 UTC?"


def test_operator_can_create(direct_vm, market_contract, direct_owner, direct_alice):
    direct_vm.sender = direct_owner
    market_contract.set_market_operator(str(direct_alice))
    direct_vm.sender = direct_alice
    assert create_market(market_contract, "ETH") == 0


def test_ordinary_user_cannot_create(direct_vm, market_contract, direct_alice):
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Unauthorized creator"):
        create_market(market_contract)


def test_only_owner_can_set_operator(direct_vm, market_contract, direct_alice, direct_bob):
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Only owner"):
        market_contract.set_market_operator(str(direct_bob))


@pytest.mark.parametrize("asset", ["BTC", "ETH", "BNB", "SOL"])
def test_supported_assets_derive_pair_and_question(direct_vm, market_contract, direct_owner, asset):
    direct_vm.sender = direct_owner
    create_market(market_contract, asset)
    market = json.loads(market_contract.get_market(0))
    assert market["pair"] == asset + "USDT"
    assert market["question"].startswith("Will " + asset + "USDT")
    assert market["question"].endswith("?")


def test_unsupported_asset_rejected(direct_vm, market_contract, direct_owner):
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("Unsupported asset"):
        create_market(market_contract, "DOGE")


def test_misaligned_candle_rejected(direct_vm, market_contract, direct_owner):
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("aligned to a UTC hour"):
        create_market(market_contract, candle_start=CANDLE_START + 1)


def test_past_or_started_candle_rejected(direct_vm, market_contract, direct_owner):
    direct_vm.sender = direct_owner
    for timestamp in (CANDLE_START - 7200, NOW):
        with direct_vm.expect_revert("in the future"):
            create_market(market_contract, candle_start=timestamp)


def test_minimum_creation_lead_time_is_enforced(direct_vm, market_contract, direct_owner):
    direct_vm.sender = direct_owner
    warp(direct_vm, "2026-01-01T00:45:00Z")
    with direct_vm.expect_revert("Insufficient creation lead time"):
        create_market(market_contract, candle_start=CANDLE_START)


def test_duplicate_market_rejected(direct_vm, market_contract, direct_owner):
    direct_vm.sender = direct_owner
    create_market(market_contract)
    with direct_vm.expect_revert("Duplicate market"):
        create_market(market_contract)


def test_contract_stake_constants_govern_bets(direct_vm, market_contract, direct_owner, direct_alice):
    direct_vm.sender = direct_owner
    create_market(market_contract)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN - 1
    with direct_vm.expect_revert("below minimum"):
        market_contract.place_bet(0, "UP")
    bet(direct_vm, market_contract, direct_alice, "UP", 9 * GEN)
    direct_vm.sender = direct_alice
    direct_vm.value = 2 * GEN
    with direct_vm.expect_revert("above maximum"):
        market_contract.place_bet(0, "UP")


def test_protocol_stats_expose_contract_owned_configuration(market_contract):
    stats = json.loads(market_contract.get_protocol_stats())
    assert stats["supported_assets"] == ["BTC", "ETH", "BNB", "SOL"]
    assert stats["providers"] == ["BINANCE", "BYBIT", "GATEIO", "MEXC", "BITGET"]
    assert stats["configured_source_count"] == 5
    assert stats["required_matching_votes"] == 3
