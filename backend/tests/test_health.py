from fastapi.testclient import TestClient
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app

client = TestClient(app)

def test_health():
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json()['ok'] is True


def test_protected_route_requires_auth():
    response = client.get('/api/posts/mine')
    assert response.status_code == 401
    assert response.json()['message'] == 'Authentication required'


def test_missing_api_route_returns_json_404():
    response = client.get('/api/not-a-route')
    assert response.status_code == 404
    assert response.json()['message'] == 'Not found'
