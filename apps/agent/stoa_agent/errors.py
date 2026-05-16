from __future__ import annotations


class StoaError(Exception):
    """Base for all stoa-agent errors."""


class IrysUploadError(StoaError):
    pass


class ArcSubmitError(StoaError):
    pass


class TradingAgentsInferenceError(StoaError):
    pass
