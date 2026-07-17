import json

from conftest import CANDLE_START, create_market, warp


def test_display_status_and_readiness_follow_transaction_time(direct_vm, market_contract, direct_owner):
    direct_vm.sender = direct_owner
    create_market(market_contract)
    assert market_contract.get_market_display_status(0) == "OPEN"
    warp(direct_vm, "2026-01-01T01:00:00Z")
    assert market_contract.get_market_display_status(0) == "CLOSED"
    assert market_contract.is_market_ready_for_settlement(0) is False
    warp(direct_vm, "2026-01-01T02:02:00Z")
    assert market_contract.get_market_display_status(0) == "READY_FOR_SETTLEMENT"
    assert market_contract.is_market_ready_for_settlement(0) is True


def test_due_and_active_pagination_remain_bounded(direct_vm, market_contract, direct_owner):
    direct_vm.sender = direct_owner
    create_market(market_contract, "BTC", CANDLE_START)
    create_market(market_contract, "ETH", CANDLE_START)
    active = json.loads(market_contract.get_active_market_ids(0, 1))
    assert active["market_ids"] == ["0"]
    assert active["has_more"] is True
    warp(direct_vm, "2026-01-01T02:02:00Z")
    due = json.loads(market_contract.get_due_market_ids(0, 50))
    assert due["market_ids"] == ["0", "1"]


def test_invalid_market_id_is_explicit(direct_vm, market_contract):
    with direct_vm.expect_revert("Invalid market ID"):
        market_contract.get_market(99)
