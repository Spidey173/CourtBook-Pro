import os
from app import create_app

# Vercel Python Serverless Runtime looks for a WSGI callable named 'app'
env = os.environ.get('FLASK_ENV', 'production')
app = create_app(env)
