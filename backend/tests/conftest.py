"""Test environment: Settings requires SECRET_KEY (no insecure default)."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-0123456789")
