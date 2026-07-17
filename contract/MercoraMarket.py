# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
import typing
from genlayer import *

CATEGORY = "CRYPTO"
MARKET_TYPE = "ONE_HOUR_DIRECTION"
QUOTE_ASSET = "USDT"
INTERVAL = "1H"
TIMEZONE = "UTC"
INTERVAL_SECONDS = 3600
MINIMUM_CREATION_LEAD_TIME = 1800
SETTLEMENT_SAFETY_DELAY = 120
SOURCE_COUNT = 5
REQUIRED_VOTES = 3
MIN_STAKE = u256(1000000000000000000)
MAX_STAKE = u256(10000000000000000000)

OUTCOME_UP = "UP"
OUTCOME_DOWN = "DOWN"
OUTCOME_INCONCLUSIVE = "INCONCLUSIVE"
OUTCOME_CANCELLED = "CANCELLED"
OUTCOME_NONE = "NONE"
SOURCE_VALID = "VALID"
SOURCE_UNAVAILABLE = "UNAVAILABLE"
UNAVAILABLE_REASONS = [
    "TIMEOUT", "REQUEST_FAILED", "HTTP_ERROR", "EMPTY_RESPONSE", "MALFORMED_RESPONSE",
    "CANDLE_NOT_FOUND", "WRONG_TIMESTAMP", "PAIR_MISMATCH", "INTERVAL_MISMATCH", "INVALID_PRICE",
]

STATUS_OPEN = "OPEN"
STATUS_SETTLED = "SETTLED"
STATUS_INCONCLUSIVE = "INCONCLUSIVE"
STATUS_CANCELLED = "CANCELLED"

BPS = u256(10000)
MAX_PAGE = 50
MAX_VIEW_IDS = 100
MAX_RESPONSE_BYTES = 100000

ASSETS = ["BTC", "ETH", "BNB", "SOL"]
PROVIDERS = ["BINANCE", "BYBIT", "GATEIO", "MEXC", "BITGET"]
SYMBOLS = {
    "BINANCE": {"BTC": "BTCUSDT", "ETH": "ETHUSDT", "BNB": "BNBUSDT", "SOL": "SOLUSDT"},
    "BYBIT": {"BTC": "BTCUSDT", "ETH": "ETHUSDT", "BNB": "BNBUSDT", "SOL": "SOLUSDT"},
    "GATEIO": {"BTC": "BTC_USDT", "ETH": "ETH_USDT", "BNB": "BNB_USDT", "SOL": "SOL_USDT"},
    "MEXC": {"BTC": "BTCUSDT", "ETH": "ETHUSDT", "BNB": "BNBUSDT", "SOL": "SOLUSDT"},
    "BITGET": {"BTC": "BTCUSDT", "ETH": "ETHUSDT", "BNB": "BNBUSDT", "SOL": "SOLUSDT"},
}
BASE_URLS = {
    "BINANCE": "https://api.binance.com", "BYBIT": "https://api.bybit.com",
    "GATEIO": "https://api.gateio.ws", "MEXC": "https://api.mexc.com", "BITGET": "https://api.bitget.com",
}
ENDPOINTS = {
    "BINANCE": "/api/v3/klines", "BYBIT": "/v5/market/kline",
    "GATEIO": "/api/v4/spot/candlesticks", "MEXC": "/api/v3/klines", "BITGET": "/api/v3/market/candles",
}
PROVIDER_INTERVALS = {
    "BINANCE": "1h", "BYBIT": "60", "GATEIO": "1h", "MEXC": "60m", "BITGET": "1H",
}
FIXED_QUERY_PARAMETERS = {
    "BINANCE": "interval=1h&limit=1", "BYBIT": "category=spot&interval=60&limit=2",
    "GATEIO": "interval=1h", "MEXC": "interval=60m&limit=1",
    "BITGET": "category=SPOT&interval=1H&type=market&limit=2",
}
TIMESTAMP_UNITS = {
    "BINANCE": "MILLISECONDS", "BYBIT": "MILLISECONDS", "GATEIO": "SECONDS",
    "MEXC": "MILLISECONDS", "BITGET": "MILLISECONDS",
}
RESPONSE_CONTAINERS = {"BINANCE": "ROOT_ARRAY", "BYBIT": "result.list", "GATEIO": "ROOT_ARRAY", "MEXC": "ROOT_ARRAY", "BITGET": "data"}
OPENING_TIMESTAMP_INDEXES = {"BINANCE": 0, "BYBIT": 0, "GATEIO": 0, "MEXC": 0, "BITGET": 0}
OPEN_PRICE_INDEXES = {"BINANCE": 1, "BYBIT": 1, "GATEIO": 5, "MEXC": 1, "BITGET": 1}
CLOSE_PRICE_INDEXES = {"BINANCE": 4, "BYBIT": 4, "GATEIO": 2, "MEXC": 4, "BITGET": 4}
SUCCESS_VALIDATION = {"BINANCE": "HTTP_2XX_ARRAY", "BYBIT": "HTTP_2XX_RETCODE_0", "GATEIO": "HTTP_2XX_ARRAY", "MEXC": "HTTP_2XX_ARRAY", "BITGET": "HTTP_2XX_CODE_00000"}
UP_LABEL = "UP"
DOWN_LABEL = "DOWN"
UP_RULE = "The completed one-hour candle closing price is greater than its opening price."
DOWN_RULE = "The completed one-hour candle closing price is equal to or lower than its opening price."


@gl.evm.contract_interface
class _NativeRecipient:
    class View:
        pass

    class Write:
        pass


class MercoraMarket(gl.Contract):
    owner: str
    market_operator: str
    next_market_id: u256
    open_market_count: u256
    settled_market_count: u256
    cancelled_market_count: u256
    inconclusive_market_count: u256
    total_market_volume: u256
    total_claimed_amount: u256
    total_refunded_amount: u256
    markets: TreeMap[str, str]
    market_keys: TreeMap[str, str]
    market_ids: str
    user_participated_market_ids: TreeMap[str, str]
    up_stakes: TreeMap[str, str]
    down_stakes: TreeMap[str, str]
    total_stakes: TreeMap[str, str]
    claim_status: TreeMap[str, str]
    claimed_amounts: TreeMap[str, str]

    def __init__(self):
        self.owner = self._address(gl.message.sender_address)
        self.market_operator = ""
        self.next_market_id = u256(0)
        self.open_market_count = u256(0)
        self.settled_market_count = u256(0)
        self.cancelled_market_count = u256(0)
        self.inconclusive_market_count = u256(0)
        self.total_market_volume = u256(0)
        self.total_claimed_amount = u256(0)
        self.total_refunded_amount = u256(0)
        self.markets = TreeMap[str, str]()
        self.market_keys = TreeMap[str, str]()
        self.market_ids = "[]"
        self.user_participated_market_ids = TreeMap[str, str]()
        self.up_stakes = TreeMap[str, str]()
        self.down_stakes = TreeMap[str, str]()
        self.total_stakes = TreeMap[str, str]()
        self.claim_status = TreeMap[str, str]()
        self.claimed_amounts = TreeMap[str, str]()

    @gl.public.write
    def set_market_operator(self, operator: str) -> None:
        if self._sender() != self.owner:
            raise gl.vm.UserError("Only owner can set market operator")
        self.market_operator = self._normalize_address(operator)

    @gl.public.write
    def create_market(self, asset: str, candle_start: u256) -> u256:
        sender = self._sender()
        if sender != self.owner and sender != self.market_operator:
            raise gl.vm.UserError("Unauthorized creator")
        clean_asset = str(asset).strip().upper()
        if clean_asset not in ASSETS:
            raise gl.vm.UserError("Unsupported asset")
        if candle_start % u256(INTERVAL_SECONDS) != u256(0):
            raise gl.vm.UserError("Candle start must be aligned to a UTC hour")
        now = self._now()
        if candle_start <= now:
            raise gl.vm.UserError("Candle start must be in the future")
        if candle_start < now + u256(MINIMUM_CREATION_LEAD_TIME):
            raise gl.vm.UserError("Insufficient creation lead time")
        market_key = self._market_key(clean_asset, INTERVAL, candle_start)
        if market_key in self.market_keys:
            raise gl.vm.UserError("Duplicate market")
        market_id = self.next_market_id
        candle_end = candle_start + u256(INTERVAL_SECONDS)
        settle_after = candle_end + u256(SETTLEMENT_SAFETY_DELAY)
        pair = clean_asset + QUOTE_ASSET
        market = {
            "market_id": str(market_id),
            "market_key": market_key,
            "created_by": sender,
            "asset": clean_asset,
            "pair": pair,
            "category": CATEGORY,
            "market_type": MARKET_TYPE,
            "quote_asset": QUOTE_ASSET,
            "interval": INTERVAL,
            "timezone": TIMEZONE,
            "question": self._question(pair, int(candle_start), int(candle_end)),
            "up_label": UP_LABEL,
            "down_label": DOWN_LABEL,
            "up_rule": UP_RULE,
            "down_rule": DOWN_RULE,
            "betting_close": str(candle_start),
            "candle_start": str(candle_start),
            "candle_end": str(candle_end),
            "settle_after": str(settle_after),
            "created_at": str(now),
            "resolved_at": "0",
            "status": STATUS_OPEN,
            "final_outcome": OUTCOME_NONE,
            "total_up_pool": "0",
            "total_down_pool": "0",
            "total_pool": "0",
            "number_of_bettors": "0",
            "settlement": self._empty_settlement(OUTCOME_NONE, "NOT_SETTLED"),
        }
        self._save_market(market_id, market)
        self.market_keys[market_key] = str(market_id)
        self._append_global_id(market_id)
        self.next_market_id = market_id + u256(1)
        self.open_market_count = self.open_market_count + u256(1)
        return market_id

    @gl.public.write.payable
    def place_bet(self, market_id: u256, position: str) -> None:
        market = self._market(market_id)
        side = self._position(position)
        amount = gl.message.value
        if amount < MIN_STAKE:
            raise gl.vm.UserError("Stake below minimum of 1 GEN")
        if self._s(market, "status") != STATUS_OPEN or self._now() >= self._u(market, "betting_close"):
            raise gl.vm.UserError("Betting closed")
        wallet = self._sender()
        key = self._position_key(market_id, wallet)
        current = self._map_amount(self.total_stakes, key)
        if current + amount > MAX_STAKE:
            raise gl.vm.UserError("Stake above maximum of 10 GEN per wallet per market")
        up_stake = self._map_amount(self.up_stakes, key)
        down_stake = self._map_amount(self.down_stakes, key)
        if side == OUTCOME_UP and down_stake > u256(0) or side == OUTCOME_DOWN and up_stake > u256(0):
            raise gl.vm.UserError("Wallet cannot bet both positions in the same market")
        if current == u256(0):
            market["number_of_bettors"] = str(self._u(market, "number_of_bettors") + u256(1))
            self._append_wallet_id(self.user_participated_market_ids, wallet, market_id)
        if side == OUTCOME_UP:
            self._set_amount(self.up_stakes, key, up_stake + amount)
            market["total_up_pool"] = str(self._u(market, "total_up_pool") + amount)
        else:
            self._set_amount(self.down_stakes, key, down_stake + amount)
            market["total_down_pool"] = str(self._u(market, "total_down_pool") + amount)
        self._set_amount(self.total_stakes, key, current + amount)
        market["total_pool"] = str(self._u(market, "total_pool") + amount)
        self.total_market_volume = self.total_market_volume + amount
        self._save_market(market_id, market)

    @gl.public.write
    def settle_market(self, market_id: u256) -> None:
        sender = self._sender()
        if sender != self.owner and sender != self.market_operator:
            raise gl.vm.UserError("Unauthorized settlement caller")
        market = self._market(market_id)
        if self._s(market, "status") != STATUS_OPEN:
            raise gl.vm.UserError("Market already settled")
        if self._now() < self._u(market, "settle_after"):
            raise gl.vm.UserError("Settlement attempted too early")
        if self._u(market, "total_up_pool") == u256(0) or self._u(market, "total_down_pool") == u256(0):
            result = self._empty_settlement(OUTCOME_CANCELLED, "ONE_SIDED_OR_EMPTY_MARKET")
            self._finish_market(market_id, market, STATUS_CANCELLED, OUTCOME_CANCELLED, result)
            self.cancelled_market_count = self.cancelled_market_count + u256(1)
            return
        result = self._resolve_market(
            self._s(market, "asset"), self._u(market, "candle_start"), self._u(market, "candle_end")
        )
        outcome = str(result["final_outcome"])
        if outcome == OUTCOME_INCONCLUSIVE:
            self._finish_market(market_id, market, STATUS_INCONCLUSIVE, outcome, result)
            self.inconclusive_market_count = self.inconclusive_market_count + u256(1)
        else:
            self._finish_market(market_id, market, STATUS_SETTLED, outcome, result)
            self.settled_market_count = self.settled_market_count + u256(1)

    @gl.public.write
    def claim_winnings(self, market_id: u256) -> u256:
        market = self._market(market_id)
        if self._s(market, "status") != STATUS_SETTLED:
            raise gl.vm.UserError("Nothing claimable")
        wallet = self._sender()
        key = self._position_key(market_id, wallet)
        if self._map_bool(self.claim_status, key):
            raise gl.vm.UserError("Duplicate claim")
        payout = self._claimable(market, key)
        if payout == u256(0):
            raise gl.vm.UserError("Nothing claimable")
        self._record_claim(key, payout)
        self.total_claimed_amount = self.total_claimed_amount + payout
        _NativeRecipient(Address(wallet)).emit_transfer(value=payout)
        return payout

    @gl.public.write
    def claim_refund(self, market_id: u256) -> u256:
        market = self._market(market_id)
        status = self._s(market, "status")
        if status != STATUS_INCONCLUSIVE and status != STATUS_CANCELLED:
            raise gl.vm.UserError("Nothing refundable")
        wallet = self._sender()
        key = self._position_key(market_id, wallet)
        if self._map_bool(self.claim_status, key):
            raise gl.vm.UserError("Duplicate refund")
        refund = self._map_amount(self.total_stakes, key)
        if refund == u256(0):
            raise gl.vm.UserError("Nothing refundable")
        self._record_claim(key, refund)
        self.total_refunded_amount = self.total_refunded_amount + refund
        _NativeRecipient(Address(wallet)).emit_transfer(value=refund)
        return refund

    @gl.public.view
    def get_market(self, market_id: u256) -> str:
        market = self._market(market_id)
        output = dict(market)
        output["display_status"] = self.get_market_display_status(market_id)
        return self._json(output)

    @gl.public.view
    def market_exists(self, market_id: u256) -> bool:
        return market_id < self.next_market_id and str(market_id) in self.markets

    @gl.public.view
    def get_market_count(self) -> u256:
        return self.next_market_id

    @gl.public.view
    def get_market_display_status(self, market_id: u256) -> str:
        market = self._market(market_id)
        status = self._s(market, "status")
        if status == STATUS_OPEN:
            now = self._now()
            if now >= self._u(market, "settle_after"):
                return "READY_FOR_SETTLEMENT"
            if now >= self._u(market, "betting_close"):
                return "CLOSED"
        return status

    @gl.public.view
    def is_market_ready_for_settlement(self, market_id: u256) -> bool:
        market = self._market(market_id)
        return self._s(market, "status") == STATUS_OPEN and self._now() >= self._u(market, "settle_after")

    @gl.public.view
    def get_due_market_ids(self, cursor: u256, limit: u256) -> str:
        return self._page_ids(cursor, limit, True)

    @gl.public.view
    def get_active_market_ids(self, cursor: u256, limit: u256) -> str:
        return self._page_ids(cursor, limit, False)

    @gl.public.view
    def get_market_ids(self, cursor: u256, limit: u256) -> str:
        return self._json(self._newest_id_page(self._list(self.market_ids), cursor, limit, False))

    @gl.public.view
    def get_completed_market_ids(self, cursor: u256, limit: u256) -> str:
        return self._json(self._newest_id_page(self._list(self.market_ids), cursor, limit, True))

    @gl.public.view
    def get_market_probabilities_bps(self, market_id: u256) -> str:
        market = self._market(market_id)
        total = self._u(market, "total_pool")
        if total == u256(0):
            return self._json({"up_bps": "0", "down_bps": "0"})
        up_bps = self._u(market, "total_up_pool") * BPS // total
        return self._json({"up_bps": str(up_bps), "down_bps": str(BPS - up_bps)})

    @gl.public.view
    def get_user_position(self, market_id: u256, wallet: str) -> str:
        self._market(market_id)
        address = self._normalize_address(wallet)
        key = self._position_key(market_id, address)
        up_stake = self._map_amount(self.up_stakes, key)
        down_stake = self._map_amount(self.down_stakes, key)
        side = OUTCOME_NONE
        if up_stake > u256(0):
            side = OUTCOME_UP
        elif down_stake > u256(0):
            side = OUTCOME_DOWN
        return self._json({
            "market_id": str(market_id), "wallet": address, "position": side,
            "up_stake": str(up_stake), "down_stake": str(down_stake),
            "total_stake": str(self._map_amount(self.total_stakes, key)),
            "claimed": self._map_bool(self.claim_status, key),
            "claimed_amount": str(self._map_amount(self.claimed_amounts, key)),
        })

    @gl.public.view
    def get_user_market_ids(self, wallet: str) -> str:
        return self._wallet_ids(self.user_participated_market_ids, self._normalize_address(wallet))

    @gl.public.view
    def get_user_market_ids_page(self, wallet: str, cursor: u256, limit: u256) -> str:
        address = self._normalize_address(wallet)
        values = [] if address not in self.user_participated_market_ids else self._list(self.user_participated_market_ids[address])
        page = self._newest_id_page(values, cursor, limit, False)
        page["count"] = str(len(values))
        return self._json(page)

    @gl.public.view
    def get_user_market_status(self, market_id: u256, wallet: str) -> str:
        market = self._market(market_id)
        address = self._normalize_address(wallet)
        key = self._position_key(market_id, address)
        up_stake = self._map_amount(self.up_stakes, key)
        down_stake = self._map_amount(self.down_stakes, key)
        total_stake = self._map_amount(self.total_stakes, key)
        position = OUTCOME_UP if up_stake > u256(0) else OUTCOME_DOWN if down_stake > u256(0) else OUTCOME_NONE
        status = self._s(market, "status")
        claimed = self._map_bool(self.claim_status, key)
        claimable = u256(0)
        refundable = u256(0)
        if status == STATUS_SETTLED and not claimed:
            claimable = self._claimable(market, key)
        elif (status == STATUS_INCONCLUSIVE or status == STATUS_CANCELLED) and not claimed:
            refundable = total_stake
        if total_stake == u256(0):
            user_result = "NOT_PARTICIPATED"
        elif status == STATUS_OPEN:
            user_result = "PENDING"
        elif status == STATUS_SETTLED:
            user_result = "CLAIMED" if claimed else "WON" if position == self._s(market, "final_outcome") and claimable > u256(0) else "LOST"
        elif claimed:
            user_result = "REFUNDED"
        elif refundable > u256(0):
            user_result = "REFUND_AVAILABLE"
        else:
            user_result = "PENDING"
        return self._json({
            "market_id": str(market_id), "wallet": address, "participated": total_stake > u256(0),
            "position": position, "up_stake": str(up_stake), "down_stake": str(down_stake),
            "total_stake": str(total_stake), "market_status": status,
            "display_status": self.get_market_display_status(market_id),
            "final_outcome": self._s(market, "final_outcome"), "user_result": user_result,
            "claimable_amount": str(claimable), "refundable_amount": str(refundable),
            "claimed": claimed, "claimed_amount": str(self._map_amount(self.claimed_amounts, key)),
        })

    @gl.public.view
    def get_claimable_amount(self, market_id: u256, wallet: str) -> u256:
        market = self._market(market_id)
        key = self._position_key(market_id, self._normalize_address(wallet))
        if self._s(market, "status") != STATUS_SETTLED or self._map_bool(self.claim_status, key):
            return u256(0)
        return self._claimable(market, key)

    @gl.public.view
    def get_refundable_amount(self, market_id: u256, wallet: str) -> u256:
        market = self._market(market_id)
        key = self._position_key(market_id, self._normalize_address(wallet))
        status = self._s(market, "status")
        if self._map_bool(self.claim_status, key):
            return u256(0)
        if status == STATUS_INCONCLUSIVE or status == STATUS_CANCELLED:
            return self._map_amount(self.total_stakes, key)
        return u256(0)

    @gl.public.view
    def get_market_id_by_key(self, asset: str, candle_start: u256) -> str:
        clean_asset = str(asset).strip().upper()
        if clean_asset not in ASSETS:
            raise gl.vm.UserError("Unsupported asset")
        if candle_start % u256(INTERVAL_SECONDS) != u256(0):
            raise gl.vm.UserError("Candle start must be aligned to a UTC hour")
        key = self._market_key(clean_asset, INTERVAL, candle_start)
        exists = key in self.market_keys
        return self._json({"exists": exists, "market_id": self.market_keys[key] if exists else ""})

    @gl.public.view
    def validate_market_creation(self, asset: str, candle_start: u256) -> str:
        clean_asset = str(asset).strip().upper()
        now = self._now()
        minimum = now + u256(MINIMUM_CREATION_LEAD_TIME)
        pair = clean_asset + QUOTE_ASSET if clean_asset in ASSETS else ""
        reason = "VALID"
        duplicate_id = ""
        if clean_asset not in ASSETS:
            reason = "UNSUPPORTED_ASSET"
        elif candle_start % u256(INTERVAL_SECONDS) != u256(0):
            reason = "NOT_HOUR_ALIGNED"
        elif candle_start <= now:
            reason = "NOT_IN_FUTURE"
        elif candle_start < minimum:
            reason = "INSUFFICIENT_CREATION_LEAD_TIME"
        else:
            key = self._market_key(clean_asset, INTERVAL, candle_start)
            if key in self.market_keys:
                reason = "DUPLICATE_MARKET"
                duplicate_id = self.market_keys[key]
        candle_end = candle_start + u256(INTERVAL_SECONDS)
        return self._json({
            "valid": reason == "VALID", "reason": reason, "asset": clean_asset, "pair": pair,
            "candle_start": str(candle_start), "candle_end": str(candle_end),
            "settle_after": str(candle_end + u256(SETTLEMENT_SAFETY_DELAY)),
            "minimum_allowed_candle_start": str(minimum), "duplicate_market_id": duplicate_id,
        })

    @gl.public.view
    def get_market_configuration(self) -> str:
        return self._json({
            "category": CATEGORY, "market_type": MARKET_TYPE, "supported_assets": ASSETS,
            "quote_asset": QUOTE_ASSET, "interval": INTERVAL,
            "interval_seconds": str(INTERVAL_SECONDS), "timezone": TIMEZONE,
            "minimum_creation_lead_time_seconds": str(MINIMUM_CREATION_LEAD_TIME),
            "settlement_safety_delay_seconds": str(SETTLEMENT_SAFETY_DELAY),
            "minimum_stake": str(MIN_STAKE), "maximum_stake_per_wallet": str(MAX_STAKE),
            "configured_source_count": str(SOURCE_COUNT), "required_matching_votes": str(REQUIRED_VOTES),
            "providers": PROVIDERS, "up_rule": UP_RULE, "down_rule": DOWN_RULE,
        })

    @gl.public.view
    def get_protocol_stats(self) -> str:
        return self._json({
            "owner": self.owner, "market_operator": self.market_operator,
            "market_count": str(self.next_market_id),
            "open_market_count": str(self.open_market_count),
            "settled_market_count": str(self.settled_market_count),
            "cancelled_market_count": str(self.cancelled_market_count),
            "inconclusive_market_count": str(self.inconclusive_market_count),
            "total_market_volume": str(self.total_market_volume),
            "total_claimed_amount": str(self.total_claimed_amount),
            "total_refunded_amount": str(self.total_refunded_amount),
            "minimum_stake": str(MIN_STAKE), "maximum_stake_per_wallet": str(MAX_STAKE),
            "category": CATEGORY, "market_type": MARKET_TYPE, "quote_asset": QUOTE_ASSET,
            "interval": INTERVAL, "interval_seconds": INTERVAL_SECONDS,
            "minimum_creation_lead_time_seconds": MINIMUM_CREATION_LEAD_TIME,
            "settlement_safety_delay_seconds": SETTLEMENT_SAFETY_DELAY,
            "configured_source_count": SOURCE_COUNT, "required_matching_votes": REQUIRED_VOTES,
            "supported_assets": ASSETS, "providers": PROVIDERS,
            "contract_balance": str(self.balance),
        })

    def _resolve_market(self, asset: str, candle_start: u256, candle_end: u256) -> dict:
        expected_asset = str(asset)
        expected_start = int(candle_start)
        expected_end = int(candle_end)

        def leader_fn():
            return self._collect_evidence(expected_asset, expected_start, expected_end)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            proposal = leaders_res.calldata
            if not self._valid_result(proposal, expected_asset, expected_start, expected_end):
                return False
            return self._evidence_supports(proposal, leader_fn())

        return gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

    def _collect_evidence(self, asset: str, candle_start: int, candle_end: int) -> dict:
        sources = {
            "BINANCE": self._fetch_binance(asset, candle_start, candle_end),
            "BYBIT": self._fetch_bybit(asset, candle_start, candle_end),
            "GATEIO": self._fetch_gateio(asset, candle_start, candle_end),
            "MEXC": self._fetch_mexc(asset, candle_start, candle_end),
            "BITGET": self._fetch_bitget(asset, candle_start, candle_end),
        }
        return self._result_from_sources(asset, candle_start, candle_end, sources)

    def _result_from_sources(self, asset: str, candle_start: int, candle_end: int, sources: dict) -> dict:
        up_votes = 0
        down_votes = 0
        unavailable_votes = 0
        for provider in PROVIDERS:
            evidence = sources[provider]
            if evidence.get("status") == SOURCE_VALID and evidence.get("direction") == OUTCOME_UP:
                up_votes += 1
            elif evidence.get("status") == SOURCE_VALID and evidence.get("direction") == OUTCOME_DOWN:
                down_votes += 1
            else:
                unavailable_votes += 1
        return {
            "asset": asset, "interval": INTERVAL,
            "candle_start": str(candle_start), "candle_end": str(candle_end),
            "final_outcome": self._vote_outcome(up_votes, down_votes),
            "valid_source_count": SOURCE_COUNT - unavailable_votes,
            "up_votes": up_votes, "down_votes": down_votes,
            "unavailable_votes": unavailable_votes, "sources": sources,
        }

    def _fetch_binance(self, asset: str, candle_start: int, candle_end: int) -> dict:
        symbol = SYMBOLS["BINANCE"][asset]
        url = BASE_URLS["BINANCE"] + ENDPOINTS["BINANCE"] + "?symbol=" + symbol + "&startTime=" + str(candle_start * 1000) + "&endTime=" + str(candle_end * 1000 - 1) + "&" + FIXED_QUERY_PARAMETERS["BINANCE"]
        return self._fetch_evidence("BINANCE", symbol, url, candle_start, candle_end)

    def _fetch_bybit(self, asset: str, candle_start: int, candle_end: int) -> dict:
        symbol = SYMBOLS["BYBIT"][asset]
        url = BASE_URLS["BYBIT"] + ENDPOINTS["BYBIT"] + "?symbol=" + symbol + "&start=" + str(candle_start * 1000) + "&end=" + str(candle_end * 1000 - 1) + "&" + FIXED_QUERY_PARAMETERS["BYBIT"]
        return self._fetch_evidence("BYBIT", symbol, url, candle_start, candle_end)

    def _fetch_gateio(self, asset: str, candle_start: int, candle_end: int) -> dict:
        symbol = SYMBOLS["GATEIO"][asset]
        url = BASE_URLS["GATEIO"] + ENDPOINTS["GATEIO"] + "?currency_pair=" + symbol + "&from=" + str(candle_start) + "&to=" + str(candle_end) + "&" + FIXED_QUERY_PARAMETERS["GATEIO"]
        return self._fetch_evidence("GATEIO", symbol, url, candle_start, candle_end)

    def _fetch_mexc(self, asset: str, candle_start: int, candle_end: int) -> dict:
        symbol = SYMBOLS["MEXC"][asset]
        url = BASE_URLS["MEXC"] + ENDPOINTS["MEXC"] + "?symbol=" + symbol + "&startTime=" + str(candle_start * 1000) + "&endTime=" + str(candle_end * 1000 - 1) + "&" + FIXED_QUERY_PARAMETERS["MEXC"]
        return self._fetch_evidence("MEXC", symbol, url, candle_start, candle_end)

    def _fetch_bitget(self, asset: str, candle_start: int, candle_end: int) -> dict:
        symbol = SYMBOLS["BITGET"][asset]
        url = BASE_URLS["BITGET"] + ENDPOINTS["BITGET"] + "?symbol=" + symbol + "&startTime=" + str(candle_start * 1000) + "&endTime=" + str(candle_end * 1000 - 1) + "&" + FIXED_QUERY_PARAMETERS["BITGET"]
        return self._fetch_evidence("BITGET", symbol, url, candle_start, candle_end)

    def _fetch_evidence(self, provider: str, symbol: str, url: str, candle_start: int, candle_end: int) -> dict:
        fetched = self._request_json(url)
        if fetched.get("ok") is not True:
            return self._unavailable(str(fetched.get("reason")))
        rows = self._provider_rows(provider, fetched.get("payload"))
        if rows is None:
            return self._unavailable("MALFORMED_RESPONSE")
        return self._evidence_from_rows(provider, symbol, rows, candle_start, candle_end)

    def _provider_rows(self, provider: str, payload: typing.Any) -> typing.Any:
        validation = SUCCESS_VALIDATION[provider]
        if validation == "HTTP_2XX_RETCODE_0" and (not isinstance(payload, dict) or payload.get("retCode") != 0):
            return None
        if validation == "HTTP_2XX_CODE_00000" and (not isinstance(payload, dict) or payload.get("code") != "00000"):
            return None
        container = RESPONSE_CONTAINERS[provider]
        if container == "result.list":
            result = payload.get("result") if isinstance(payload, dict) else None
            rows = result.get("list") if isinstance(result, dict) else None
        elif container == "data":
            rows = payload.get("data") if isinstance(payload, dict) else None
        else:
            rows = payload
        return rows if isinstance(rows, list) else None

    def _request_json(self, url: str) -> dict:
        try:
            response = gl.nondet.web.get(url)
            status, body = self._response(response)
            if status == 408 or status == 504:
                return {"ok": False, "reason": "TIMEOUT"}
            if status < 200 or status >= 300:
                return {"ok": False, "reason": "HTTP_ERROR"}
            if len(body.strip()) == 0:
                return {"ok": False, "reason": "EMPTY_RESPONSE"}
            if len(body) > MAX_RESPONSE_BYTES:
                return {"ok": False, "reason": "MALFORMED_RESPONSE"}
            try:
                payload = json.loads(body)
            except ValueError:
                return {"ok": False, "reason": "MALFORMED_RESPONSE"}
            return {"ok": True, "payload": payload}
        except gl.vm.UserError as error:
            reason = "TIMEOUT" if "timeout" in str(error).lower() else "REQUEST_FAILED"
            return {"ok": False, "reason": reason}
        except (ValueError, TypeError, UnicodeError):
            return {"ok": False, "reason": "MALFORMED_RESPONSE"}
        except Exception as error:
            reason = "TIMEOUT" if "timeout" in str(error).lower() else "REQUEST_FAILED"
            return {"ok": False, "reason": reason}

    def _evidence_from_rows(self, provider: str, symbol: str, rows: list, candle_start: int, candle_end: int) -> dict:
        open_index = OPEN_PRICE_INDEXES[provider]
        close_index = CLOSE_PRICE_INDEXES[provider]
        timestamp_index = OPENING_TIMESTAMP_INDEXES[provider]
        selected = self._exact_candle(rows, candle_start, TIMESTAMP_UNITS[provider], timestamp_index, max(timestamp_index, open_index, close_index) + 1)
        if selected.get("row") is None:
            return self._unavailable(str(selected.get("reason")))
        return self._candle_evidence(
            symbol, PROVIDER_INTERVALS[provider], selected["row"],
            timestamp_index, open_index, close_index, TIMESTAMP_UNITS[provider], candle_start, candle_end,
        )

    def _exact_candle(self, rows: list, expected_start: int, unit: str, timestamp_index: int, minimum_length: int) -> dict:
        saw_row = False
        for row in rows:
            if isinstance(row, list) and len(row) >= minimum_length:
                saw_row = True
                if self._timestamp_seconds(row[timestamp_index], unit) == expected_start:
                    return {"row": row, "reason": ""}
        return {"row": None, "reason": "WRONG_TIMESTAMP" if saw_row else "CANDLE_NOT_FOUND"}

    def _candle_evidence(self, symbol: str, interval: str, row: list, timestamp_index: int, open_index: int, close_index: int, unit: str, candle_start: int, candle_end: int) -> dict:
        try:
            timestamp = self._timestamp_seconds(row[timestamp_index], unit)
            if timestamp != candle_start:
                return self._unavailable("WRONG_TIMESTAMP")
            open_price = self._normalize_price(row[open_index])
            close_price = self._normalize_price(row[close_index])
            if len(open_price) == 0 or len(close_price) == 0:
                return self._unavailable("INVALID_PRICE")
            return {
                "status": SOURCE_VALID, "symbol": symbol, "interval": interval,
                "candle_start": str(timestamp), "candle_end": str(candle_end),
                "open": open_price, "close": close_price,
                "direction": OUTCOME_UP if self._decimal_greater(close_price, open_price) else OUTCOME_DOWN,
            }
        except (ValueError, TypeError, KeyError, IndexError):
            return self._unavailable("MALFORMED_RESPONSE")
    def _valid_result(self, result: typing.Any, asset: str, candle_start: int, candle_end: int) -> bool:
        if not isinstance(result, dict):
            return False
        expected_keys = {
            "asset", "interval", "candle_start", "candle_end", "final_outcome",
            "valid_source_count", "up_votes", "down_votes", "unavailable_votes", "sources",
        }
        if set(result.keys()) != expected_keys:
            return False
        if result.get("asset") != asset or result.get("interval") != INTERVAL:
            return False
        if result.get("candle_start") != str(candle_start) or result.get("candle_end") != str(candle_end):
            return False
        sources = result.get("sources")
        if not isinstance(sources, dict) or set(sources.keys()) != set(PROVIDERS):
            return False
        up_votes = 0
        down_votes = 0
        unavailable_votes = 0
        for provider in PROVIDERS:
            source = sources[provider]
            if not self._valid_source_record(provider, asset, candle_start, candle_end, source):
                return False
            if source.get("status") == SOURCE_VALID and source.get("direction") == OUTCOME_UP:
                up_votes += 1
            elif source.get("status") == SOURCE_VALID and source.get("direction") == OUTCOME_DOWN:
                down_votes += 1
            else:
                unavailable_votes += 1
        if not self._count_equals(result.get("up_votes"), up_votes) or not self._count_equals(result.get("down_votes"), down_votes):
            return False
        if not self._count_equals(result.get("unavailable_votes"), unavailable_votes) or not self._count_equals(result.get("valid_source_count"), SOURCE_COUNT - unavailable_votes):
            return False
        return result.get("final_outcome") == self._vote_outcome(up_votes, down_votes)

    def _valid_source_record(self, provider: str, asset: str, candle_start: int, candle_end: int, source: typing.Any) -> bool:
        if not isinstance(source, dict):
            return False
        if source.get("status") == SOURCE_UNAVAILABLE:
            return set(source.keys()) == {"status", "reason"} and source.get("reason") in UNAVAILABLE_REASONS
        if source.get("status") != SOURCE_VALID:
            return False
        valid_keys = {"status", "symbol", "interval", "candle_start", "candle_end", "open", "close", "direction"}
        if set(source.keys()) != valid_keys:
            return False
        if source.get("symbol") != SYMBOLS[provider][asset] or source.get("interval") != PROVIDER_INTERVALS[provider]:
            return False
        if source.get("candle_start") != str(candle_start) or source.get("candle_end") != str(candle_end):
            return False
        open_price = self._normalize_price(source.get("open"))
        close_price = self._normalize_price(source.get("close"))
        if len(open_price) == 0 or len(close_price) == 0:
            return False
        if open_price != source.get("open") or close_price != source.get("close"):
            return False
        direction = OUTCOME_UP if self._decimal_greater(close_price, open_price) else OUTCOME_DOWN
        return source.get("direction") == direction

    def _evidence_supports(self, proposal: dict, validator_result: dict) -> bool:
        if not self._valid_result(validator_result, str(proposal["asset"]), int(proposal["candle_start"]), int(proposal["candle_end"])):
            return False
        if proposal.get("final_outcome") != validator_result.get("final_outcome"):
            return False
        for provider in PROVIDERS:
            leader_source = proposal["sources"][provider]
            validator_source = validator_result["sources"][provider]
            if leader_source.get("status") == SOURCE_VALID and validator_source.get("status") == SOURCE_VALID:
                if self._json(leader_source) != self._json(validator_source):
                    return False
        return True

    def _count_equals(self, value: typing.Any, expected: int) -> bool:
        return isinstance(value, int) and not isinstance(value, bool) and value == expected

    def _vote_outcome(self, up_votes: int, down_votes: int) -> str:
        if up_votes >= REQUIRED_VOTES:
            return OUTCOME_UP
        if down_votes >= REQUIRED_VOTES:
            return OUTCOME_DOWN
        return OUTCOME_INCONCLUSIVE

    def _timestamp_seconds(self, value: typing.Any, unit: str) -> int:
        text = str(value).strip()
        if len(text) == 0 or not text.isdigit():
            return -1
        timestamp = int(text)
        return timestamp // 1000 if unit == "MILLISECONDS" else timestamp

    def _normalize_price(self, value: typing.Any) -> str:
        if not isinstance(value, str) and not isinstance(value, int):
            return ""
        text = str(value).strip()
        pieces = text.split(".")
        if len(pieces) > 2 or len(pieces[0]) == 0 or not pieces[0].isdigit():
            return ""
        fraction = pieces[1] if len(pieces) == 2 else ""
        if len(fraction) > 0 and not fraction.isdigit():
            return ""
        whole = pieces[0].lstrip("0") or "0"
        fraction = fraction.rstrip("0")
        normalized = whole + ("." + fraction if fraction else "")
        if whole == "0" and len(fraction.replace("0", "")) == 0:
            return ""
        return normalized

    def _decimal_greater(self, left: str, right: str) -> bool:
        left_parts = left.split(".")
        right_parts = right.split(".")
        left_whole = left_parts[0]
        right_whole = right_parts[0]
        if len(left_whole) != len(right_whole):
            return len(left_whole) > len(right_whole)
        if left_whole != right_whole:
            return left_whole > right_whole
        left_fraction = left_parts[1] if len(left_parts) == 2 else ""
        right_fraction = right_parts[1] if len(right_parts) == 2 else ""
        width = max(len(left_fraction), len(right_fraction))
        return left_fraction.ljust(width, "0") > right_fraction.ljust(width, "0")

    def _response(self, response: typing.Any) -> typing.Any:
        status = 200
        if hasattr(response, "status_code"):
            status = int(response.status_code)
        elif hasattr(response, "status"):
            status = int(response.status)
        body_value: typing.Any = response.body if hasattr(response, "body") else ""
        body = body_value.decode("utf-8", errors="replace") if isinstance(body_value, bytes) else str(body_value)
        return status, body

    def _unavailable(self, reason: str) -> dict:
        return {"status": SOURCE_UNAVAILABLE, "reason": reason}

    def _empty_settlement(self, outcome: str, reason: str) -> dict:
        return {
            "final_outcome": outcome, "valid_source_count": 0, "up_votes": 0,
            "down_votes": 0, "unavailable_votes": 0, "sources": {}, "reason": reason,
        }

    def _finish_market(self, market_id: u256, market: typing.Any, status: str, outcome: str, result: dict) -> None:
        market["status"] = status
        market["final_outcome"] = outcome
        market["resolved_at"] = str(self._now())
        market["settlement"] = result
        self.open_market_count = self.open_market_count - u256(1)
        self._save_market(market_id, market)

    def _claimable(self, market: typing.Any, key: str) -> u256:
        outcome = self._s(market, "final_outcome")
        if outcome == OUTCOME_UP:
            stake = self._map_amount(self.up_stakes, key)
            winning_pool = self._u(market, "total_up_pool")
        elif outcome == OUTCOME_DOWN:
            stake = self._map_amount(self.down_stakes, key)
            winning_pool = self._u(market, "total_down_pool")
        else:
            return u256(0)
        if stake == u256(0) or winning_pool == u256(0):
            return u256(0)
        return stake * self._u(market, "total_pool") // winning_pool

    def _record_claim(self, key: str, amount: u256) -> None:
        self._set_bool(self.claim_status, key, True)
        self._set_amount(self.claimed_amounts, key, amount)

    def _page_ids(self, cursor: u256, limit: u256, due_only: bool) -> str:
        page_limit = self._limit(limit)
        ids = self._list(self.market_ids)
        index = int(cursor)
        scanned = 0
        output = []
        now = self._now()
        while index < len(ids) and scanned < page_limit * 5 and len(output) < page_limit:
            market_id = u256(self._uint_text(str(ids[index]), "market id"))
            market = self._market(market_id)
            include = self._s(market, "status") == STATUS_OPEN
            if due_only:
                include = include and now >= self._u(market, "settle_after")
            if include:
                output.append(str(market_id))
            index += 1
            scanned += 1
        return self._json({"market_ids": output, "next_cursor": str(index), "has_more": index < len(ids)})

    def _newest_id_page(self, values: list, cursor: u256, limit: u256, completed_only: bool) -> dict:
        page_limit = self._limit(limit)
        offset = int(cursor)
        output = []
        scanned = 0
        if offset >= len(values):
            return {"market_ids": output, "next_cursor": str(offset), "has_more": False}
        scan_limit = page_limit * 5 if completed_only else page_limit
        while offset < len(values) and scanned < scan_limit and len(output) < page_limit:
            market_id = str(values[len(values) - 1 - offset])
            if not completed_only or self._completed(self._s(self._market(u256(self._uint_text(market_id, "market id"))), "status")):
                output.append(market_id)
            offset += 1
            scanned += 1
        return {"market_ids": output, "next_cursor": str(offset), "has_more": offset < len(values)}

    def _completed(self, status: str) -> bool:
        return status == STATUS_SETTLED or status == STATUS_INCONCLUSIVE or status == STATUS_CANCELLED

    def _question(self, pair: str, candle_start: int, candle_end: int) -> str:
        return "Will " + pair + " close higher than it opened between " + self._format_utc(candle_start) + " and " + self._format_utc(candle_end) + " UTC?"

    def _format_utc(self, timestamp: int) -> str:
        year, month, day, hour = self._utc_parts(timestamp)
        months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        return str(day) + " " + months[month - 1] + " " + str(year) + " " + self._two(hour) + ":00"

    def _utc_parts(self, timestamp: int) -> typing.Any:
        days = timestamp // 86400
        seconds = timestamp % 86400
        z = days + 719468
        era = z // 146097
        day_of_era = z - era * 146097
        year_of_era = (day_of_era - day_of_era // 1460 + day_of_era // 36524 - day_of_era // 146096) // 365
        year = year_of_era + era * 400
        day_of_year = day_of_era - (365 * year_of_era + year_of_era // 4 - year_of_era // 100)
        month_piece = (5 * day_of_year + 2) // 153
        day = day_of_year - (153 * month_piece + 2) // 5 + 1
        month = month_piece + 3 if month_piece < 10 else month_piece - 9
        year += 1 if month <= 2 else 0
        return year, month, day, seconds // 3600

    def _two(self, value: int) -> str:
        return "0" + str(value) if value < 10 else str(value)

    def _market_key(self, asset: str, interval: str, candle_start: u256) -> str:
        return asset + ":" + interval + ":" + str(candle_start)

    def _position(self, value: str) -> str:
        result = str(value).strip().upper()
        if result != OUTCOME_UP and result != OUTCOME_DOWN:
            raise gl.vm.UserError("Invalid position")
        return result

    def _market(self, market_id: u256) -> typing.Any:
        key = str(market_id)
        if market_id >= self.next_market_id or key not in self.markets:
            raise gl.vm.UserError("Invalid market ID")
        try:
            market = json.loads(self.markets[key])
        except ValueError:
            raise gl.vm.UserError("Stored market record is malformed")
        if not isinstance(market, dict):
            raise gl.vm.UserError("Stored market record is malformed")
        return market

    def _save_market(self, market_id: u256, market: typing.Any) -> None:
        self.markets[str(market_id)] = self._json(market)

    def _u(self, market: typing.Any, key: str) -> u256:
        if key not in market or not isinstance(market[key], str):
            raise gl.vm.UserError("Invalid stored numeric field: " + key)
        return u256(self._uint_text(str(market[key]), key))

    def _s(self, market: typing.Any, key: str) -> str:
        if key not in market or not isinstance(market[key], str):
            raise gl.vm.UserError("Invalid stored string field: " + key)
        return str(market[key])

    def _uint_text(self, value: str, label: str) -> int:
        text = str(value).strip()
        if len(text) == 0 or not text.isdigit():
            raise gl.vm.UserError("Invalid " + label)
        return int(text)

    def _map_amount(self, store: TreeMap[str, str], key: str) -> u256:
        return u256(0) if key not in store else u256(self._uint_text(store[key], "stored amount"))

    def _set_amount(self, store: TreeMap[str, str], key: str, amount: u256) -> None:
        store[key] = str(amount)

    def _map_bool(self, store: TreeMap[str, str], key: str) -> bool:
        if key not in store:
            return False
        if store[key] == "true":
            return True
        if store[key] == "false":
            return False
        raise gl.vm.UserError("Invalid stored claim status")

    def _set_bool(self, store: TreeMap[str, str], key: str, value: bool) -> None:
        store[key] = "true" if value else "false"

    def _append_global_id(self, market_id: u256) -> None:
        values = self._list(self.market_ids)
        values.append(str(market_id))
        self.market_ids = self._json(values)

    def _append_wallet_id(self, store: TreeMap[str, str], wallet: str, market_id: u256) -> None:
        values = [] if wallet not in store else self._list(store[wallet])
        if str(market_id) not in values:
            values.append(str(market_id))
            store[wallet] = self._json(values)

    def _wallet_ids(self, store: TreeMap[str, str], wallet: str) -> str:
        values = [] if wallet not in store else self._list(store[wallet])
        return self._json({"market_ids": [str(value) for value in values[:MAX_VIEW_IDS]], "count": str(len(values)), "truncated": len(values) > MAX_VIEW_IDS})

    def _list(self, value: str) -> typing.Any:
        try:
            result = json.loads(value)
        except ValueError:
            raise gl.vm.UserError("Stored id list is malformed")
        if not isinstance(result, list):
            raise gl.vm.UserError("Stored id list is malformed")
        return result

    def _position_key(self, market_id: u256, wallet: str) -> str:
        return str(market_id) + ":" + wallet

    def _limit(self, value: u256) -> int:
        limit = int(value)
        if limit < 1:
            return 1
        return MAX_PAGE if limit > MAX_PAGE else limit

    def _json(self, value: typing.Any) -> str:
        return json.dumps(value, sort_keys=True, separators=(",", ":"))

    def _sender(self) -> str:
        return self._address(gl.message.sender_address)

    def _address(self, value: typing.Any) -> str:
        return self._normalize_address(str(value))

    def _normalize_address(self, value: str) -> str:
        text = str(value).strip().lower()
        if len(text) != 42 or not text.startswith("0x"):
            raise gl.vm.UserError("Invalid address")
        for char in text[2:]:
            if char not in "0123456789abcdef":
                raise gl.vm.UserError("Invalid address")
        return text

    def _now(self) -> u256:
        return u256(self._unix(str(gl.message_raw["datetime"])))

    def _unix(self, value: str) -> int:
        text = str(value)
        if len(text) < 19 or text[4] != "-" or text[7] != "-" or text[10] != "T" or text[13] != ":" or text[16] != ":":
            raise gl.vm.UserError("Invalid UTC datetime")
        year = self._digits(text, 0, 4)
        month = self._digits(text, 5, 7)
        day = self._digits(text, 8, 10)
        hour = self._digits(text, 11, 13)
        minute = self._digits(text, 14, 16)
        second = self._digits(text, 17, 19)
        if year < 1970 or month < 1 or month > 12 or day < 1 or day > self._days_in_month(year, month) or hour > 23 or minute > 59 or second > 59:
            raise gl.vm.UserError("Invalid UTC datetime")
        index = 19
        if index < len(text) and text[index] == ".":
            index += 1
            while index < len(text) and text[index].isdigit():
                index += 1
        offset = 0
        if index < len(text):
            if text[index] == "Z" and index + 1 == len(text):
                offset = 0
            elif text[index] in ["+", "-"] and index + 6 == len(text) and text[index + 3] == ":":
                offset = self._digits(text, index + 1, index + 3) * 3600 + self._digits(text, index + 4, index + 6) * 60
                if text[index] == "-":
                    offset = -offset
            else:
                raise gl.vm.UserError("Invalid UTC datetime")
        return self._days_since_epoch(year, month, day) * 86400 + hour * 3600 + minute * 60 + second - offset

    def _digits(self, text: str, start: int, end: int) -> int:
        value = 0
        for index in range(start, end):
            if not text[index].isdigit():
                raise gl.vm.UserError("Invalid UTC datetime")
            value = value * 10 + ord(text[index]) - ord("0")
        return value

    def _days_since_epoch(self, year: int, month: int, day: int) -> int:
        adjusted = year - 1 if month <= 2 else year
        era = adjusted // 400
        year_of_era = adjusted - era * 400
        month_piece = month - 3 if month > 2 else month + 9
        day_of_year = (153 * month_piece + 2) // 5 + day - 1
        return era * 146097 + year_of_era * 365 + year_of_era // 4 - year_of_era // 100 + day_of_year - 719468

    def _days_in_month(self, year: int, month: int) -> int:
        if month == 2:
            return 29 if year % 400 == 0 or year % 4 == 0 and year % 100 != 0 else 28
        return 30 if month in [4, 6, 9, 11] else 31
