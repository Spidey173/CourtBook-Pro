import os
from app import create_app

# Vercel looks for the WSGI/ASGI application callable named 'app'
env = os.environ.get('FLASK_ENV', 'production')
app = create_app(env)
