from dotenv import load_dotenv
load_dotenv()

import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from database import init_db
from routes import bp


app = Flask(__name__)

# Lock CORS to your frontend domain only
CORS(app, origins=[os.environ.get("FRONTEND_URL", "http://localhost:5173")])

# Rate limiter — limits by IP address
# Uses Redis so all Gunicorn workers share the same counter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per hour"],
    storage_uri=os.environ.get("REDIS_URL", "memory://")
)

# Make limiter available to blueprints
app.limiter = limiter

app.register_blueprint(bp)

@app.before_request
def exempt_options():
    if request.method == "OPTIONS":
        return app.make_default_options_response()

# Global error handlers
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(429)
def rate_limited(e):
    return jsonify({"error": "Too many requests, slow down"}), 429

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

# Run DB init and scheduler at startup — outside __main__ so
# Gunicorn picks it up (Gunicorn never hits __main__)
init_db()

from scheduler import start_scheduler
start_scheduler()

if __name__ == "__main__":
    app.run(debug=False)