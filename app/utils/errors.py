"""Global Exception & HTTP Error Handlers."""
import logging
from flask import Flask, request
from pydantic import ValidationError
from app.utils.responses import error_response

logger = logging.getLogger(__name__)


def register_error_handlers(app: Flask) -> None:
    """Register custom error handlers on the Flask app."""

    @app.errorhandler(ValidationError)
    def handle_pydantic_validation_error(e: ValidationError):
        """Handle Pydantic schema validation errors."""
        formatted_errors = []
        for err in e.errors():
            loc = " -> ".join(str(l) for l in err['loc'])
            formatted_errors.append(f"{loc}: {err['msg']}")
        msg = "; ".join(formatted_errors)
        return error_response(message=f"Validation failed: {msg}", error=msg, status_code=422)

    @app.errorhandler(400)
    def handle_400(e):
        return error_response(str(e.description if hasattr(e, 'description') else 'Bad request'), status_code=400)

    @app.errorhandler(401)
    def handle_401(e):
        return error_response('Authentication required', status_code=401)

    @app.errorhandler(403)
    def handle_403(e):
        return error_response('Access forbidden: insufficient permissions', status_code=403)

    @app.errorhandler(404)
    def handle_404(e):
        return error_response('Requested resource was not found', status_code=404)

    @app.errorhandler(429)
    def handle_429(e):
        return error_response('Rate limit exceeded. Please slow down.', status_code=429)

    @app.errorhandler(500)
    def handle_500(e):
        logger.exception("Unhandled Internal Server Error: %s", e)
        return error_response('An unexpected internal server error occurred', status_code=500)
