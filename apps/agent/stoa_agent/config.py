from __future__ import annotations

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    deepseek_api_key: str
    openai_api_key: str = ""

    # Additional LLM providers routed onto the Triad. The local env names start
    # with a digit (2_LLM_*, 3_LLM_*); Render forbids env keys that start with a
    # digit, so each field also accepts a Render-safe alias (LLM2_*, LLM3_*).
    provider_2_model: str = Field(
        default="", validation_alias=AliasChoices("2_LLM_MODEL", "LLM2_MODEL")
    )
    provider_2_api_key: str = Field(
        default="", validation_alias=AliasChoices("2_LLM_API_KEY", "LLM2_API_KEY")
    )
    provider_2_base_url: str = Field(
        default="", validation_alias=AliasChoices("2_LLM_BASE_URL", "LLM2_BASE_URL")
    )
    provider_3_model: str = Field(
        default="", validation_alias=AliasChoices("3_LLM_MODEL", "LLM3_MODEL")
    )
    provider_3_api_key: str = Field(
        default="", validation_alias=AliasChoices("3_LLM_API_KEY", "LLM3_API_KEY")
    )
    provider_3_base_url: str = Field(
        default="", validation_alias=AliasChoices("3_LLM_BASE_URL", "LLM3_BASE_URL")
    )

    # Macro data (FRED) for The Quantec's CPI / Fed-funds inputs.
    fred_api_key: str = ""

    # Embeddings for The Bayesian's pgvector memory. gemini-embedding-001 with
    # dimensions=1536 matches the vector(1536) column in migration 007.
    embedding_model: str = "gemini-embedding-001"
    embedding_dims: int = 1536

    irys_private_key: str
    irys_node_url: str = "https://devnet.irys.xyz"
    irys_token: str = "matic"
    irys_provider_url: str = "https://rpc-amoy.polygon.technology"
    agent_private_key: str = ""
    arc_testnet_rpc: str
    stoa_registry_address: str
    stoa_treasury_address: str = ""
    agent_id: str | None = None
    agent_persona: str = ""

    # Circle Wallets (Programmable Wallets / W3S)
    use_circle_wallets: bool = False
    circle_api_key: str = ""
    circle_entity_secret: str = ""
    circle_wallet_id: str = ""
    circle_wallet_set_id: str = ""

    # Autonomous loop configuration
    loop_interval_seconds: int = 600
    loop_min_liquidity: float = 5000
    loop_min_confidence_bps: int = 5000
    loop_max_markets_per_cycle: int = 3
    loop_inference_timeout_seconds: int = 120

    # Supabase (for state rehydration across restarts)
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    model_config = {
        "env_file": ".env.local",
        "env_file_encoding": "utf-8",
        "populate_by_name": True,
        "extra": "ignore",
    }


def load_settings() -> Settings:
    return Settings()
