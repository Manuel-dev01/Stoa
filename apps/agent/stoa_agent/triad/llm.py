"""Shared LLM helper for the Triad — DeepSeek via litellm, JSON-only output.

Mirrors the JSON-extraction approach in stoa_agent.reasoning.runner so all
three agents parse model output the same way.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass

from stoa_agent.config import Settings
from stoa_agent.errors import TradingAgentsInferenceError

DEFAULT_MODEL = "deepseek/deepseek-chat"


@dataclass(frozen=True)
class ModelSpec:
    """A resolved provider target for one Triad agent."""

    model: str
    api_key: str | None = None
    api_base: str | None = None

    @property
    def is_deepseek(self) -> bool:
        return self.api_base is None and self.model.startswith("deepseek/")


def _deepseek_spec() -> ModelSpec:
    return ModelSpec(model=DEFAULT_MODEL)


def model_for(settings: Settings, agent: str) -> ModelSpec:
    """Route a Triad agent to its provider.

      quantec    → provider 2 (Groq)
      bayesian   → provider 3 (Gemini)
      calibrator → DeepSeek

    Groq/Gemini are OpenAI-compatible custom endpoints, so the model string is
    prefixed `openai/` and the api_base + api_key are carried explicitly. If a
    provider isn't configured, the agent falls back to DeepSeek.
    """
    if agent == "quantec" and settings.provider_2_model and settings.provider_2_base_url:
        return ModelSpec(
            model=f"openai/{settings.provider_2_model}",
            api_key=settings.provider_2_api_key,
            api_base=settings.provider_2_base_url,
        )
    if agent == "bayesian" and settings.provider_3_model and settings.provider_3_base_url:
        return ModelSpec(
            model=f"openai/{settings.provider_3_model}",
            api_key=settings.provider_3_api_key,
            api_base=settings.provider_3_base_url,
        )
    return _deepseek_spec()


def _extract_json(content: str) -> dict:
    # Prefer a fenced ```json block, then any balanced-looking object.
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
    if match:
        raw = match.group(1)
    else:
        match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", content, re.DOTALL)
        if not match:
            raise TradingAgentsInferenceError(
                f"Could not parse JSON from model response: {content[:300]}"
            )
        raw = match.group(0)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise TradingAgentsInferenceError(f"Invalid JSON from model: {e}") from e


def _complete(
    settings: Settings,
    spec: ModelSpec,
    system: str,
    user: str,
    temperature: float,
    max_tokens: int,
) -> str:
    import litellm

    kwargs: dict = {
        "model": spec.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if spec.api_base:
        # OpenAI-compatible custom endpoint (Groq / Gemini). Pass creds explicitly.
        kwargs["api_base"] = spec.api_base
        kwargs["api_key"] = spec.api_key
    else:
        # DeepSeek reads its key from the environment.
        os.environ["DEEPSEEK_API_KEY"] = settings.deepseek_api_key

    response = litellm.completion(**kwargs)
    return response.choices[0].message.content or ""


def call_llm_json(
    settings: Settings,
    system: str,
    user: str,
    *,
    spec: ModelSpec | None = None,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.3,
    max_tokens: int = 2500,
) -> dict:
    """Call the model with a system + user prompt and return parsed JSON.

    `spec` routes to a specific provider; if it fails (bad key, endpoint down,
    unparseable output), retry once against DeepSeek so one flaky provider never
    empties the feed. Pass `model=` for the legacy DeepSeek-only path.
    """
    target = spec or ModelSpec(model=model)
    try:
        content = _complete(settings, target, system, user, temperature, max_tokens)
        return _extract_json(content)
    except Exception:
        if target.is_deepseek:
            raise
        # Fallback: the same prompt against DeepSeek.
        content = _complete(settings, _deepseek_spec(), system, user, temperature, max_tokens)
        return _extract_json(content)


def clamp_rating(value: object) -> int:
    try:
        return max(-3, min(3, int(value)))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0


def clamp_bps(value: object) -> int:
    try:
        return max(0, min(10000, int(value)))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0
