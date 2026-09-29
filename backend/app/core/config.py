import os
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env file from root or backend directory
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

class Settings(BaseModel):
    PROJECT_NAME: str = "Code Masters Round 2 Platform API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api"

    # Server configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Supabase credentials (for the NEW dedicated Round 2 project)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")

    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "cm_round2_super_secure_jwt_secret_key_987654321")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Admin Master Credentials for bootstrap / initial setup
    ADMIN_DEFAULT_EMAIL: str = os.getenv("ADMIN_DEFAULT_EMAIL", "kalaichelvit@veltech.edu.in")
    ADMIN_DEFAULT_PASSWORD: str = os.getenv("ADMIN_DEFAULT_PASSWORD", "Admin@cseaiml26")

settings = Settings()
