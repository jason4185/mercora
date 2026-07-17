import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = str(ROOT / "contract" / "MercoraMarket.py")
GEN = 10**18
NOW = 1767225600  # 2026-01-01T00:00:00Z
CANDLE_START = NOW + 3600
CANDLE_END = CANDLE_START + 3600
SETTLE_AFTER = CANDLE_END + 120

HOST_PATTERNS = {
    "BINANCE": r"api\.binance\.com",
    "BYBIT": r"api\.bybit\.com",
    "GATEIO": r"api\.gateio\.ws",
    "MEXC": r"api\.mexc\.com",
    "BITGET": r"api\.bitget\.com",
}


def warp(direct_vm, timestamp):
    direct_vm.warp(timestamp)
    sys.modules["genlayer.gl"].message_raw["datetime"] = timestamp


def create_market(contract, asset="BTC", candle_start=CANDLE_START):
    return contract.create_market(asset, candle_start)


def _row(provider, timestamp, open_price, close_price):
    source_timestamp = timestamp if provider == "GATEIO" else timestamp * 1000
    if provider == "GATEIO":
        return [str(source_timestamp), "0", close_price, "0", "0", open_price]
    return [str(source_timestamp), open_price, "0", "0", close_price, "0"]


def _body(provider, row):
    if provider == "BYBIT":
        return json.dumps({"retCode": 0, "result": {"list": [row]}})
    if provider == "BITGET":
        return json.dumps({"code": "00000", "data": [row]})
    return json.dumps([row])


def mock_sources(direct_vm, results=None):
    """Install all five mocks. Values: UP, DOWN, EQUAL, WRONG_TIMESTAMP,
    EMPTY, EMPTY_ARRAY, MALFORMED, MALFORMED_CONTAINER, INVALID_PRICE, ZERO,
    NEGATIVE, HTTP_ERROR, TIMEOUT, PROVIDER_ERROR, or REQUEST_FAILED.
    """
    selected = results or {}
    for provider, pattern in HOST_PATTERNS.items():
        mode = selected.get(provider, "UP")
        if mode == "TIMEOUT":
            direct_vm.mock_web(pattern, {"status": 504, "body": "gateway timeout"})
            continue
        if mode == "HTTP_ERROR":
            direct_vm.mock_web(pattern, {"status": 500, "body": "provider error"})
            continue
        if mode == "EMPTY":
            direct_vm.mock_web(pattern, {"status": 200, "body": ""})
            continue
        if mode == "MALFORMED":
            direct_vm.mock_web(pattern, {"status": 200, "body": "{"})
            continue
        if mode == "EMPTY_ARRAY":
            direct_vm.mock_web(pattern, {"status": 200, "body": _body(provider, None).replace("[null]", "[]")})
            continue
        if mode == "MALFORMED_CONTAINER":
            direct_vm.mock_web(pattern, {"status": 200, "body": json.dumps({"unexpected": []})})
            continue
        if mode == "PROVIDER_ERROR":
            body = {"retCode": 10001, "result": {"list": []}} if provider == "BYBIT" else {"code": "40000", "data": []}
            direct_vm.mock_web(pattern, {"status": 200, "body": json.dumps(body)})
            continue
        if mode == "REQUEST_FAILED":
            continue
        timestamp = CANDLE_START + 3600 if mode == "WRONG_TIMESTAMP" else CANDLE_START
        open_price = "bad" if mode in ("INVALID_DECIMAL", "INVALID_PRICE") else "100.00"
        if mode == "ZERO":
            open_price = "0"
        elif mode == "NEGATIVE":
            open_price = "-100"
        close_price = "101.50"
        if mode == "UP_HIGH":
            open_price, close_price = "65000.25", "65200.75"
        if mode == "DOWN":
            close_price = "99.25"
        elif mode == "EQUAL":
            close_price = "100.000"
        row = _row(provider, timestamp, open_price, close_price)
        direct_vm.mock_web(pattern, {"status": 200, "body": _body(provider, row)})


def bet(direct_vm, contract, sender, side, amount=GEN, market_id=0):
    direct_vm.sender = sender
    direct_vm.value = amount
    contract.place_bet(market_id, side)
    direct_vm.value = 0


def fund_both_sides(direct_vm, contract, up_wallet, down_wallet):
    bet(direct_vm, contract, up_wallet, "UP")
    bet(direct_vm, contract, down_wallet, "DOWN")


def settle(direct_vm, contract, results=None):
    mock_sources(direct_vm, results)
    warp(direct_vm, "2026-01-01T02:02:00Z")
    direct_vm.value = 0
    contract.settle_market(0)
    return json.loads(contract.get_market(0))


@pytest.fixture
def market_contract(direct_vm, direct_deploy, direct_owner):
    direct_vm.sender = direct_owner
    contract = direct_deploy(CONTRACT)
    warp(direct_vm, "2026-01-01T00:00:00Z")
    return contract
