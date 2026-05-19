from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    deepseek_api_key: str
    openai_api_key: str = ""
    irys_private_key: str
    irys_node_url: str = "https://devnet.irys.xyz"
    irys_token: str = "matic"
    irys_provider_url: str = "https://rpc-amoy.polygon.technology"
    agent_private_key: str
    arc_testnet_rpc: str
    stoa_registry_address: str
    agent_id: str | None = None

    model_config = {"env_file": ".env.local", "env_file_encoding": "utf-8"}


def load_settings() -> Settings:
    return Settings()
