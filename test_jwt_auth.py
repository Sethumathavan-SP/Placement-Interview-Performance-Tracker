"""Comprehensive tests for the JWT authentication system."""

import os
import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-that-is-at-least-32-bytes-long-for-hmac")

from httpx import AsyncClient, ASGITransport

from password_utils import hash_password, verify_password
from auth import (
    create_access_token,
    create_refresh_token,
    create_password_reset_token,
    create_csrf_token,
    decode_token,
)
import db


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test.db")
    monkeypatch.setattr(db, "DB_PATH", test_db)
    db.init_db()
    yield


@pytest.fixture
def client():
    from app import app, limiter
    # Disable rate limiting for tests
    limiter.enabled = False
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


# ==================== PASSWORD UTILS ====================


class TestPasswordUtils:
    def test_hash_and_verify(self):
        h = hash_password("hello123")
        assert h.startswith("$2b$12$")
        assert verify_password("hello123", h)
        assert not verify_password("wrong", h)

    def test_different_hashes_same_password(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2

    def test_empty_password(self):
        h = hash_password("")
        assert verify_password("", h)
        assert not verify_password("x", h)


# ==================== TOKEN CREATION & DECODING ====================


class TestTokens:
    def test_access_token_roundtrip(self):
        user = {"uuid": "u1", "gmail": "a@b.com", "role": "Student", "department": "CSE"}
        tok = create_access_token(user)
        payload = decode_token(tok)
        assert payload["sub"] == "u1"
        assert payload["type"] == "access"
        assert payload["role"] == "Student"

    def test_refresh_token_roundtrip(self):
        user = {"uuid": "u1", "gmail": "a@b.com", "role": "Mentor", "department": "ECE"}
        tok = create_refresh_token(user)
        payload = decode_token(tok)
        assert payload["sub"] == "u1"
        assert payload["type"] == "refresh"

    def test_password_reset_token(self):
        user = {"uuid": "u1", "gmail": "a@b.com"}
        tok = create_password_reset_token(user)
        payload = decode_token(tok)
        assert payload["type"] == "password_reset"

    def test_csrf_token_uniqueness(self):
        t1 = create_csrf_token()
        t2 = create_csrf_token()
        assert t1 != t2
        assert len(t1) == 64


# ==================== DB BLACKLIST & AUDIT ====================


class TestBlacklist:
    def test_blacklist_and_check(self):
        from datetime import datetime, timezone, timedelta
        assert not db.is_token_blacklisted("jti-1")
        db.blacklist_token("jti-1", "access", "user-1", datetime.now(timezone.utc) + timedelta(hours=1))
        assert db.is_token_blacklisted("jti-1")
        assert not db.is_token_blacklisted("jti-other")


class TestAuditLog:
    def test_log_and_retrieve(self):
        db.log_auth_event("u1", "a@b.com", "LOGIN_SUCCESS", "127.0.0.1", "test-agent")
        logs = db.get_auth_audit_log(user_id="u1")
        assert len(logs) == 1
        assert logs[0]["event_type"] == "LOGIN_SUCCESS"


# ==================== BCRYPT MIGRATION ====================


class TestBcryptMigration:
    def test_plaintext_passwords_get_migrated(self, tmp_path, monkeypatch):
        test_db = str(tmp_path / "migration_test.db")
        monkeypatch.setattr(db, "DB_PATH", test_db)

        import sqlite3
        conn = sqlite3.connect(test_db)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("CREATE TABLE authenticate (uuid TEXT PRIMARY KEY, gmail TEXT UNIQUE, password TEXT, role TEXT)")
        c.execute("INSERT INTO authenticate VALUES ('u1', 'test@gmail.com', 'plaintext123', 'Student')")
        conn.commit()
        conn.close()

        db.init_db()

        user = db.get_user_by_gmail("test@gmail.com")
        assert user["password"].startswith("$2b$")
        assert verify_password("plaintext123", user["password"])


# ==================== API INTEGRATION TESTS ====================


@pytest.mark.anyio(backends=["asyncio"])
class TestLoginEndpoint:
    async def test_login_success(self, client):
        async with client as c:
            r = await c.post("/api/login", json={"gmail": "coordinator@gmail.com", "password": "coord123"})
            assert r.status_code == 200
            data = r.json()
            assert data["success"]
            assert data["user"]["role"] == "Coordinator"
            assert "csrf_token" in data
            assert "access_token" in r.cookies
            assert "refresh_token" in r.cookies

    async def test_login_wrong_password(self, client):
        async with client as c:
            r = await c.post("/api/login", json={"gmail": "coordinator@gmail.com", "password": "wrong"})
            assert r.status_code == 401
            assert "access_token" not in r.cookies

    async def test_login_nonexistent_user(self, client):
        async with client as c:
            r = await c.post("/api/login", json={"gmail": "nobody@gmail.com", "password": "x"})
            assert r.status_code == 401


@pytest.mark.anyio(backends=["asyncio"])
class TestProtectedRoutes:
    async def test_access_without_token(self, client):
        async with client as c:
            r = await c.get("/api/drives")
            assert r.status_code == 401

    async def test_access_with_token(self, client):
        async with client as c:
            login = await c.post("/api/login", json={"gmail": "coordinator@gmail.com", "password": "coord123"})
            cookies = dict(login.cookies)
            r = await c.get("/api/drives", cookies=cookies)
            assert r.status_code == 200

    async def test_me_endpoint(self, client):
        async with client as c:
            login = await c.post("/api/login", json={"gmail": "student@gmail.com", "password": "student123"})
            cookies = dict(login.cookies)
            r = await c.get("/api/me", cookies=cookies)
            assert r.status_code == 200
            assert r.json()["user"]["role"] == "Student"


@pytest.mark.anyio(backends=["asyncio"])
class TestRoleEnforcement:
    async def test_student_cannot_access_coordinator_route(self, client):
        async with client as c:
            login = await c.post("/api/login", json={"gmail": "student@gmail.com", "password": "student123"})
            cookies = dict(login.cookies)
            r = await c.get("/api/users", cookies=cookies)
            assert r.status_code == 403

    async def test_coordinator_can_access_coordinator_route(self, client):
        async with client as c:
            login = await c.post("/api/login", json={"gmail": "coordinator@gmail.com", "password": "coord123"})
            cookies = dict(login.cookies)
            r = await c.get("/api/users", cookies=cookies)
            assert r.status_code == 200


@pytest.mark.anyio(backends=["asyncio"])
class TestCSRFValidation:
    async def test_post_without_csrf_fails(self, client):
        async with client as c:
            login = await c.post("/api/login", json={"gmail": "coordinator@gmail.com", "password": "coord123"})
            cookies = dict(login.cookies)
            r = await c.post("/api/drives", json={
                "company_name": "Test", "job_role": "SDE", "ctc_lpa": 10
            }, cookies=cookies)
            assert r.status_code == 403

    async def test_post_with_csrf_succeeds(self, client):
        async with client as c:
            login = await c.post("/api/login", json={"gmail": "coordinator@gmail.com", "password": "coord123"})
            cookies = dict(login.cookies)
            csrf = login.json()["csrf_token"]
            r = await c.post("/api/drives", json={
                "company_name": "Test Corp", "job_role": "SDE", "ctc_lpa": 10
            }, cookies=cookies, headers={"X-CSRF-Token": csrf})
            assert r.status_code == 201


@pytest.mark.anyio(backends=["asyncio"])
class TestRefreshFlow:
    async def test_refresh_issues_new_tokens(self, client):
        async with client as c:
            login = await c.post("/api/login", json={"gmail": "coordinator@gmail.com", "password": "coord123"})
            cookies = dict(login.cookies)
            refresh_cookies = {"refresh_token": cookies["refresh_token"]}
            r = await c.post("/api/refresh", cookies=refresh_cookies)
            assert r.status_code == 200
            assert "access_token" in r.cookies
            assert r.json()["csrf_token"]

    async def test_refresh_blacklists_old_token(self, client):
        async with client as c:
            login = await c.post("/api/login", json={"gmail": "coordinator@gmail.com", "password": "coord123"})
            cookies = dict(login.cookies)
            refresh_cookies = {"refresh_token": cookies["refresh_token"]}

            r1 = await c.post("/api/refresh", cookies=refresh_cookies)
            assert r1.status_code == 200

            r2 = await c.post("/api/refresh", cookies=refresh_cookies)
            assert r2.status_code == 401


@pytest.mark.anyio(backends=["asyncio"])
class TestLogout:
    async def test_logout_blacklists_tokens(self, client):
        async with client as c:
            login = await c.post("/api/login", json={"gmail": "coordinator@gmail.com", "password": "coord123"})
            cookies = dict(login.cookies)
            csrf = login.json()["csrf_token"]

            r = await c.post("/api/logout", cookies=cookies, headers={"X-CSRF-Token": csrf})
            assert r.status_code == 200

            r2 = await c.get("/api/drives", cookies=cookies)
            assert r2.status_code == 401


@pytest.mark.anyio(backends=["asyncio"])
class TestPasswordReset:
    async def test_password_reset_request(self, client):
        async with client as c:
            r = await c.post("/api/password-reset/request", json={"gmail": "student@gmail.com"})
            assert r.status_code == 200
            assert r.json()["success"]

            logs = db.get_auth_audit_log(event_type="PASSWORD_RESET_REQUEST")
            assert len(logs) >= 1
            assert "Reset token:" in logs[0]["details"]

    async def test_password_reset_confirm(self, client):
        async with client as c:
            user = db.get_user_by_gmail("student@gmail.com")
            reset_tok = create_password_reset_token(user)

            r = await c.post("/api/password-reset/confirm", json={
                "token": reset_tok, "new_password": "newpass456"
            })
            assert r.status_code == 200

            r2 = await c.post("/api/login", json={"gmail": "student@gmail.com", "password": "newpass456"})
            assert r2.status_code == 200

            r3 = await c.post("/api/login", json={"gmail": "student@gmail.com", "password": "student123"})
            assert r3.status_code == 401

    async def test_reset_token_single_use(self, client):
        async with client as c:
            user = db.get_user_by_gmail("student@gmail.com")
            reset_tok = create_password_reset_token(user)

            r1 = await c.post("/api/password-reset/confirm", json={
                "token": reset_tok, "new_password": "first"
            })
            assert r1.status_code == 200

            r2 = await c.post("/api/password-reset/confirm", json={
                "token": reset_tok, "new_password": "second"
            })
            assert r2.status_code == 400


@pytest.mark.anyio(backends=["asyncio"])
class TestAuditLogRecorded:
    async def test_login_events_recorded(self, client):
        async with client as c:
            await c.post("/api/login", json={"gmail": "coordinator@gmail.com", "password": "coord123"})
            await c.post("/api/login", json={"gmail": "coordinator@gmail.com", "password": "wrong"})

            logs = db.get_auth_audit_log()
            types = [log["event_type"] for log in logs]
            assert "LOGIN_SUCCESS" in types
            assert "LOGIN_FAILED" in types
