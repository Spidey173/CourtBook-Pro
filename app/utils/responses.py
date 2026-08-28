"""API Response Helpers."""
from typing import Any, Optional, Dict, Tuple
from flask import jsonify, Response


def api_response(
    success: bool = True,
    data: Any = None,
    message: str = '',
    error: Optional[str] = None,
    status_code: int = 200,
    meta: Optional[Dict[str, Any]] = None,
    **extra_fields
) -> Tuple[Response, int]:
    """
    Standardized API JSON response envelope.
    """
    payload = {
        'success': success,
        'message': message,
        'data': data,
        'error': error or (None if success else message),
        **extra_fields
    }
    if meta is not None:
        payload['meta'] = meta

    return jsonify(payload), status_code


def success_response(data: Any = None, message: str = 'Operation successful', status_code: int = 200, **kwargs) -> Tuple[Response, int]:
    """Helper for successful responses."""
    return api_response(success=True, data=data, message=message, status_code=status_code, **kwargs)


def error_response(message: str = 'An error occurred', error: Optional[str] = None, status_code: int = 400, data: Any = None, **kwargs) -> Tuple[Response, int]:
    """Helper for error responses."""
    return api_response(success=False, data=data, message=message, error=error or message, status_code=status_code, **kwargs)
