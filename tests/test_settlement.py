import json

import pytest

from conftest import CANDLE_START, create_market, fund_both_sides, mock_sources, settle, warp


def prepared(direct_vm, contract, owner, alice, bob):
    direct_vm.sender = owner
    create_market(contract)
    fund_both_sides(direct_vm, contract, alice, bob)
    direct_vm.sender = owner


@pytest.mark.parametrize(
    "results,expected,up_votes,down_votes,unavailable",
    [
        ({}, "UP", 5, 0, 0),
        ({"BITGET": "DOWN"}, "UP", 4, 1, 0),
        ({"GATEIO": "DOWN", "MEXC": "DOWN"}, "UP", 3, 2, 0),
        ({"BINANCE": "DOWN", "BYBIT": "DOWN", "GATEIO": "DOWN"}, "DOWN", 2, 3, 0),
        ({"MEXC": "HTTP_ERROR", "BITGET": "EMPTY"}, "UP", 3, 0, 2),
        ({"GATEIO": "DOWN", "MEXC": "DOWN", "BITGET": "HTTP_ERROR"}, "INCONCLUSIVE", 2, 2, 1),
        ({"GATEIO": "DOWN", "MEXC": "HTTP_ERROR", "BITGET": "EMPTY"}, "INCONCLUSIVE", 2, 1, 2),
    ],
)
def test_three_of_five_vote_matrix(direct_vm, market_contract, direct_owner, direct_alice, direct_bob, results, expected, up_votes, down_votes, unavailable):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    market = settle(direct_vm, market_contract, results)
    evidence = market["settlement"]
    assert market["final_outcome"] == expected
    assert evidence["up_votes"] == up_votes
    assert evidence["down_votes"] == down_votes
    assert evidence["unavailable_votes"] == unavailable


@pytest.mark.parametrize(
    "mode,reason",
    [
        ("WRONG_TIMESTAMP", "WRONG_TIMESTAMP"),
        ("EMPTY", "EMPTY_RESPONSE"),
        ("MALFORMED", "MALFORMED_RESPONSE"),
        ("INVALID_PRICE", "INVALID_PRICE"),
        ("ZERO", "INVALID_PRICE"),
        ("NEGATIVE", "INVALID_PRICE"),
        ("HTTP_ERROR", "HTTP_ERROR"),
        ("TIMEOUT", "TIMEOUT"),
        ("REQUEST_FAILED", "REQUEST_FAILED"),
    ],
)
def test_individual_source_failures_become_unavailable(direct_vm, market_contract, direct_owner, direct_alice, direct_bob, mode, reason):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    market = settle(direct_vm, market_contract, {"BITGET": mode})
    assert market["final_outcome"] == "UP"
    assert market["settlement"]["sources"]["BITGET"] == {"status": "UNAVAILABLE", "reason": reason}


@pytest.mark.parametrize("mode,expected", [("UP", "UP"), ("EQUAL", "DOWN"), ("DOWN", "DOWN")])
def test_open_close_direction_is_deterministic(direct_vm, market_contract, direct_owner, direct_alice, direct_bob, mode, expected):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    results = {name: mode for name in ["BINANCE", "BYBIT", "GATEIO", "MEXC", "BITGET"]}
    market = settle(direct_vm, market_contract, results)
    for source in market["settlement"]["sources"].values():
        assert source["direction"] == expected
        assert source["candle_start"] == "1767229200"
        assert source["open"] == "100"


def test_prices_need_not_match_when_directions_match(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    mock_sources(direct_vm, {"BITGET": "UP_HIGH"})
    warp(direct_vm, "2026-01-01T02:02:00Z")
    market_contract.settle_market(0)
    market = json.loads(market_contract.get_market(0))
    assert market["final_outcome"] == "UP"
    assert market["settlement"]["sources"]["BINANCE"]["open"] == "100"
    assert market["settlement"]["sources"]["BITGET"]["open"] == "65000.25"


def test_settlement_too_early_rejected(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    warp(direct_vm, "2026-01-01T02:01:59Z")
    with direct_vm.expect_revert("Settlement attempted too early"):
        market_contract.settle_market(0)


def test_repeated_settlement_rejected(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    settle(direct_vm, market_contract)
    with direct_vm.expect_revert("Market already settled"):
        market_contract.settle_market(0)


def test_validator_refetches_and_compares_real_evidence_fields(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    settle(direct_vm, market_contract)
    direct_vm.clear_mocks()
    mock_sources(direct_vm, {"BITGET": "DOWN"})
    assert direct_vm.run_validator() is False


def test_validator_accepts_same_normalized_evidence(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    settle(direct_vm, market_contract)
    direct_vm.clear_mocks()
    mock_sources(direct_vm)
    assert direct_vm.run_validator() is True


@pytest.mark.parametrize(
    "results",
    [
        {},
        {"BITGET": "DOWN"},
        {"MEXC": "DOWN", "BITGET": "DOWN"},
        {"BINANCE": "DOWN", "BYBIT": "DOWN", "GATEIO": "DOWN"},
        {"MEXC": "TIMEOUT", "BITGET": "REQUEST_FAILED"},
        {"BINANCE": "DOWN", "BYBIT": "DOWN", "GATEIO": "DOWN", "MEXC": "TIMEOUT", "BITGET": "REQUEST_FAILED"},
    ],
)
def test_validator_accepts_supported_three_of_five_results(direct_vm, market_contract, direct_owner, direct_alice, direct_bob, results):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    settle(direct_vm, market_contract, results)
    direct_vm.clear_mocks()
    mock_sources(direct_vm, results)
    assert direct_vm.run_validator() is True


def test_validator_tolerates_two_validator_side_outages_when_three_sources_still_prove_outcome(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    settle(direct_vm, market_contract)
    direct_vm.clear_mocks()
    mock_sources(direct_vm, {"MEXC": "REQUEST_FAILED", "BITGET": "TIMEOUT"})
    assert direct_vm.run_validator() is True


def test_validator_accepts_leader_three_up_two_unavailable_when_validator_has_five_up(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    settle(direct_vm, market_contract, {"MEXC": "TIMEOUT", "BITGET": "REQUEST_FAILED"})
    direct_vm.clear_mocks()
    mock_sources(direct_vm)
    assert direct_vm.run_validator() is True


def test_validator_accepts_leader_three_down_two_unavailable_when_validator_has_four_down_one_up(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    leader_sources = {"BINANCE": "DOWN", "BYBIT": "DOWN", "GATEIO": "DOWN", "MEXC": "TIMEOUT", "BITGET": "REQUEST_FAILED"}
    settle(direct_vm, market_contract, leader_sources)
    direct_vm.clear_mocks()
    mock_sources(direct_vm, {"BINANCE": "DOWN", "BYBIT": "DOWN", "GATEIO": "DOWN", "MEXC": "DOWN", "BITGET": "UP"})
    assert direct_vm.run_validator() is True


def test_validator_rejects_leader_up_when_validator_independently_derives_inconclusive(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    settle(direct_vm, market_contract, {"MEXC": "TIMEOUT", "BITGET": "REQUEST_FAILED"})
    direct_vm.clear_mocks()
    mock_sources(direct_vm, {"GATEIO": "TIMEOUT", "MEXC": "DOWN", "BITGET": "REQUEST_FAILED"})
    assert direct_vm.run_validator() is False


def test_validator_rejects_leader_down_when_validator_independently_derives_up(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    settle(direct_vm, market_contract, {"BINANCE": "DOWN", "BYBIT": "DOWN", "GATEIO": "DOWN", "MEXC": "TIMEOUT", "BITGET": "REQUEST_FAILED"})
    direct_vm.clear_mocks()
    mock_sources(direct_vm)
    assert direct_vm.run_validator() is False


def test_validator_rejects_different_normalized_evidence_when_both_sources_are_valid(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    settle(direct_vm, market_contract)
    direct_vm.clear_mocks()
    mock_sources(direct_vm, {"BITGET": "UP_HIGH"})
    assert direct_vm.run_validator() is False


def test_evidence_support_rejects_validator_result_that_fails_valid_result(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    market = settle(direct_vm, market_contract)
    contract = object.__getattribute__(market_contract, "_instance")
    assert contract._evidence_supports(market["settlement"], {"final_outcome": "UP"}) is False


def test_validator_execution_has_no_storage_side_effects(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    settle(direct_vm, market_contract)
    before = market_contract.get_market(0)
    direct_vm.clear_mocks()
    mock_sources(direct_vm)
    assert direct_vm.run_validator() is True
    assert market_contract.get_market(0) == before


@pytest.mark.parametrize(
    "mutation",
    [
        "wrong_context_timestamp",
        "wrong_open",
        "wrong_close",
        "wrong_direction",
        "wrong_up_count",
        "wrong_down_count",
        "wrong_unavailable_count",
        "wrong_final_outcome",
        "unsupported_source",
        "format_only",
    ],
)
def test_validator_rejects_unsupported_or_tampered_leader_result(direct_vm, market_contract, direct_owner, direct_alice, direct_bob, mutation):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    market = settle(direct_vm, market_contract)
    proposal = json.loads(json.dumps(market["settlement"]))
    if mutation == "wrong_context_timestamp":
        proposal["candle_start"] = str(int(proposal["candle_start"]) + 3600)
    elif mutation == "wrong_open":
        proposal["sources"]["BINANCE"]["open"] = "99"
    elif mutation == "wrong_close":
        proposal["sources"]["BINANCE"]["close"] = "999"
    elif mutation == "wrong_direction":
        proposal["sources"]["BINANCE"]["direction"] = "DOWN"
    elif mutation == "wrong_up_count":
        proposal["up_votes"] = 4
    elif mutation == "wrong_down_count":
        proposal["down_votes"] = 1
    elif mutation == "wrong_unavailable_count":
        proposal["unavailable_votes"] = 1
    elif mutation == "wrong_final_outcome":
        proposal["final_outcome"] = "DOWN"
    elif mutation == "unsupported_source":
        proposal["sources"]["COINGECKO"] = proposal["sources"].pop("BINANCE")
    else:
        proposal = {"final_outcome": "UP", "up_votes": 5}
    direct_vm.clear_mocks()
    mock_sources(direct_vm)
    assert direct_vm.run_validator(leader_result=proposal) is False
