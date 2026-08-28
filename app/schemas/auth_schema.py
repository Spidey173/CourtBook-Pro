"""Authentication Request Schemas."""
from pydantic import BaseModel, Field, EmailStr, field_validator


class LoginSchema(BaseModel):
    """User login request payload."""
    username: str = Field(..., min_length=3, max_length=80, description="Username")
    password: str = Field(..., min_length=6, description="Password")


class RegisterSchema(BaseModel):
    """User registration request payload."""
    username: str = Field(..., min_length=3, max_length=80, description="Unique username")
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=6, max_length=128, description="Secure password")

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not v.strip():
            raise ValueError('Username cannot be whitespace only')
        return v.strip()
