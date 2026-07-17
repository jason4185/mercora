import json

from conftest import GEN, bet, create_market, fund_both_sides, settle, warp


def prepared(direct_vm, contract, owner):
    direct_vm.sender = owner
    create_market(contract)


def test_up_and_down_bets_and_wallet_index(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner)
    bet(direct_vm, market_contract, direct_alice, "UP")
    bet(direct_vm, market_contract, direct_alice, "UP")
    bet(direct_vm, market_contract, direct_bob, "DOWN")
    alice = json.loads(market_contract.get_user_position(0, str(direct_alice)))
    assert alice["position"] == "UP"
    assert alice["up_stake"] == str(2 * GEN)
    assert json.loads(market_contract.get_user_market_ids(str(direct_alice)))["market_ids"] == ["0"]


def test_minimum_stake_enforced(direct_vm, market_contract, direct_owner, direct_alice):
    prepared(direct_vm, market_contract, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN - 1
    with direct_vm.expect_revert("below minimum"):
        market_contract.place_bet(0, "UP")


def test_cumulative_maximum_stake_enforced(direct_vm, market_contract, direct_owner, direct_alice):
    prepared(direct_vm, market_contract, direct_owner)
    bet(direct_vm, market_contract, direct_alice, "UP", 9 * GEN)
    bet(direct_vm, market_contract, direct_alice, "UP", GEN)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert("above maximum"):
        market_contract.place_bet(0, "UP")


def test_invalid_position_and_cross_position_bet_rejected(direct_vm, market_contract, direct_owner, direct_alice):
    prepared(direct_vm, market_contract, direct_owner)
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert("Invalid position"):
        market_contract.place_bet(0, "SIDEWAYS")
    bet(direct_vm, market_contract, direct_alice, "UP")
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert("both positions"):
        market_contract.place_bet(0, "DOWN")


def test_betting_at_candle_start_is_closed(direct_vm, market_contract, direct_owner, direct_alice):
    prepared(direct_vm, market_contract, direct_owner)
    warp(direct_vm, "2026-01-01T01:00:00Z")
    direct_vm.sender = direct_alice
    direct_vm.value = GEN
    with direct_vm.expect_revert("Betting closed"):
        market_contract.place_bet(0, "UP")


def test_up_winner_proportional_claim_and_duplicate_rejected(direct_vm, market_contract, direct_owner, direct_alice, direct_bob, direct_charlie):
    prepared(direct_vm, market_contract, direct_owner)
    bet(direct_vm, market_contract, direct_alice, "UP", GEN)
    bet(direct_vm, market_contract, direct_charlie, "UP", GEN)
    bet(direct_vm, market_contract, direct_bob, "DOWN", 2 * GEN)
    direct_vm.sender = direct_owner
    settle(direct_vm, market_contract)
    assert market_contract.get_claimable_amount(0, str(direct_alice)) == 2 * GEN
    direct_vm.sender = direct_alice
    assert market_contract.claim_winnings(0) == 2 * GEN
    with direct_vm.expect_revert("Duplicate claim"):
        market_contract.claim_winnings(0)


def test_down_winner_claim_and_loser_cannot_claim(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner)
    fund_both_sides(direct_vm, market_contract, direct_alice, direct_bob)
    direct_vm.sender = direct_owner
    settle(direct_vm, market_contract, {"BINANCE": "DOWN", "BYBIT": "DOWN", "GATEIO": "DOWN"})
    direct_vm.sender = direct_bob
    assert market_contract.claim_winnings(0) == 2 * GEN
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Nothing claimable"):
        market_contract.claim_winnings(0)


def test_inconclusive_refund_and_duplicate_rejected(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner)
    fund_both_sides(direct_vm, market_contract, direct_alice, direct_bob)
    direct_vm.sender = direct_owner
    settle(direct_vm, market_contract, {"BINANCE": "UP", "BYBIT": "UP", "GATEIO": "DOWN", "MEXC": "DOWN", "BITGET": "HTTP_ERROR"})
    assert market_contract.get_refundable_amount(0, str(direct_alice)) == GEN
    direct_vm.sender = direct_alice
    assert market_contract.claim_refund(0) == GEN
    with direct_vm.expect_revert("Duplicate refund"):
        market_contract.claim_refund(0)


def test_one_sided_market_is_cancelled_and_refundable(direct_vm, market_contract, direct_owner, direct_alice):
    prepared(direct_vm, market_contract, direct_owner)
    bet(direct_vm, market_contract, direct_alice, "UP")
    warp(direct_vm, "2026-01-01T02:02:00Z")
    direct_vm.sender = direct_owner
    market_contract.settle_market(0)
    market = json.loads(market_contract.get_market(0))
    assert market["status"] == "CANCELLED"
    assert market["final_outcome"] == "CANCELLED"
    assert market_contract.get_refundable_amount(0, str(direct_alice)) == GEN
    direct_vm.sender = direct_alice
    assert market_contract.claim_refund(0) == GEN
