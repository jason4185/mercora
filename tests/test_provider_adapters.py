import pytest

from conftest import CANDLE_END, CANDLE_START, fund_both_sides, settle


PROVIDERS = ["BINANCE", "BYBIT", "GATEIO", "MEXC", "BITGET"]
SYMBOLS = {
    "BINANCE": "BTCUSDT",
    "BYBIT": "BTCUSDT",
    "GATEIO": "BTC_USDT",
    "MEXC": "BTCUSDT",
    "BITGET": "BTCUSDT",
}
INTERVALS = {"BINANCE": "1h", "BYBIT": "60", "GATEIO": "1h", "MEXC": "60m", "BITGET": "1H"}


def prepared(direct_vm, contract, owner, alice, bob):
    direct_vm.sender = owner
    contract.create_market("BTC", CANDLE_START)
    fund_both_sides(direct_vm, contract, alice, bob)
    direct_vm.sender = owner


def test_all_dedicated_adapters_extract_exact_candle_fields(direct_vm, market_contract, direct_owner, direct_alice, direct_bob):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    market = settle(direct_vm, market_contract)
    for provider, evidence in market["settlement"]["sources"].items():
        assert evidence == {
            "status": "VALID",
            "symbol": SYMBOLS[provider],
            "interval": INTERVALS[provider],
            "candle_start": str(CANDLE_START),
            "candle_end": str(CANDLE_END),
            "open": "100",
            "close": "101.5",
            "direction": "UP",
        }


@pytest.mark.parametrize("provider", PROVIDERS)
@pytest.mark.parametrize(
    "mode,reason",
    [
        ("WRONG_TIMESTAMP", "WRONG_TIMESTAMP"),
        ("EMPTY_ARRAY", "CANDLE_NOT_FOUND"),
        ("MALFORMED", "MALFORMED_RESPONSE"),
        ("MALFORMED_CONTAINER", "MALFORMED_RESPONSE"),
        ("TIMEOUT", "TIMEOUT"),
        ("INVALID_PRICE", "INVALID_PRICE"),
        ("ZERO", "INVALID_PRICE"),
        ("NEGATIVE", "INVALID_PRICE"),
    ],
)
def test_each_provider_rejects_bad_or_unavailable_candles(direct_vm, market_contract, direct_owner, direct_alice, direct_bob, provider, mode, reason):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    market = settle(direct_vm, market_contract, {provider: mode})
    assert market["settlement"]["sources"][provider] == {"status": "UNAVAILABLE", "reason": reason}


@pytest.mark.parametrize("provider", ["BYBIT", "BITGET"])
def test_provider_success_codes_are_validated(direct_vm, market_contract, direct_owner, direct_alice, direct_bob, provider):
    prepared(direct_vm, market_contract, direct_owner, direct_alice, direct_bob)
    market = settle(direct_vm, market_contract, {provider: "PROVIDER_ERROR"})
    assert market["settlement"]["sources"][provider] == {"status": "UNAVAILABLE", "reason": "MALFORMED_RESPONSE"}
