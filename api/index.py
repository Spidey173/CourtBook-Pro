import os
from app import create_app

# Vercel looks for the WSGI/ASGI application callable named 'app'
env = os.environ.get('FLASK_ENV', 'production')
flask_app = create_app(env)

class VercelPathFix:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        # Vercel forwards the original requested URI in HTTP_X_FORWARDED_URI or HTTP_X_VERCEL_FORWARDED_FOR
        # When rewrites route to /api/index.py, PATH_INFO is set to /api/index.py.
        # We restore the actual client PATH_INFO from x-forwarded-uri if present.
        forwarded_uri = environ.get('HTTP_X_FORWARDED_URI') or environ.get('HTTP_X_VERCEL_FORWARDED_URI')
        if forwarded_uri:
            # Strip query string from URI if present
            path = forwarded_uri.split('?')[0]
            environ['PATH_INFO'] = path
            environ['REQUEST_URI'] = forwarded_uri

        return self.wsgi_app(environ, start_response)

app = VercelPathFix(flask_app)
