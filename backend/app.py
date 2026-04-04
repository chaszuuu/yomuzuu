from dotenv import load_dotenv
load_dotenv()

import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from database import init_db
from routes import bp


# Point Flask to the React build output
app = Flask(__name__, static_folder='../frontend/dist', static_url_path='/assets')

# CORS only needed in local dev now (same origin in prod)
CORS(app, origins=[os.environ.get("FRONTEND_URL", "http://localhost:5173")])

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per hour"],
    storage_uri=os.environ.get("REDIS_URL", "memory://")
)

app.limiter = limiter
app.register_blueprint(bp)

@app.before_request
def exempt_options():
    if request.method == "OPTIONS":
        return app.make_default_options_response()

# ── Serve React for all non-API routes ───────────────────────────────────────
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path.startswith('api/') or path.startswith('proxy/'):
        return jsonify({"error": "Not found"}), 404
    full_path = os.path.join(app.static_folder, path)
    if path and os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')
    
@app.errorhandler(429)
def rate_limited(e):
    return jsonify({"error": "Too many requests, slow down"}), 429

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

init_db()

from scheduler import start_scheduler
start_scheduler()

if __name__ == "__main__":
    app.run(debug=False)