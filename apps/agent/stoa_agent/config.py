from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    deepseek_api_key: str
    openai_api_key: str = ""
    irys_private_key: str
    irys_node_url: str = "https://devnet.irys.xyz"
    irys_token: str = "matic"
    irys_provider_url: str = "https://rpc-amoy.polygon.technology"
    agent_private_key: str = ""
    arc_testnet_rpc: str
    stoa_registry_address: str
    stoa_treasury_address: str = ""
    agent_id: str | None = None

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

    model_config = {"env_file": ".env.local", "env_file_encoding": "utf-8"}


def load_settings() -> Settings:
    return Settings()
