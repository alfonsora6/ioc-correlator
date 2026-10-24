"""RF-03: IOC type detection (IPv4, domain, URL, MD5, SHA1, SHA256)."""
import pytest

from app.services.ioc_detect import detect_ioc

MD5 = "d41d8cd98f00b204e9800998ecf8427e"
SHA1 = "da39a3ee5e6b4b0d3255bfef95601890afd80709"
SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"


def test_ipv4():
    assert detect_ioc("8.8.8.8") == ("ip", "8.8.8.8")


def test_ipv4_is_stripped():
    assert detect_ioc("  185.220.101.34\n") == ("ip", "185.220.101.34")


def test_ipv6():
    assert detect_ioc("2001:db8::1") == ("ip", "2001:db8::1")


@pytest.mark.parametrize("value", ["evil.com", "sub.evil.example.org"])
def test_domain(value):
    assert detect_ioc(value) == ("domain", value)


def test_domain_is_lowercased():
    assert detect_ioc("Evil.COM") == ("domain", "evil.com")


@pytest.mark.parametrize(
    "value",
    ["http://evil.com/payload.exe", "https://evil.com/a?b=c", "HTTP://EVIL.com/x"],
)
def test_url(value):
    assert detect_ioc(value) == ("url", value)


@pytest.mark.parametrize("value", [MD5, SHA1, SHA256])
def test_hashes_valid(value):
    assert detect_ioc(value) == ("hash", value)


def test_hash_uppercase_is_normalized_to_lowercase():
    assert detect_ioc(SHA256.upper()) == ("hash", SHA256)


@pytest.mark.parametrize("length", [31, 33, 39, 41, 63, 65])
def test_hash_with_invalid_length_is_rejected(length):
    with pytest.raises(ValueError, match="Could not detect IOC type"):
        detect_ioc("a" * length)


def test_hash_of_63_chars_fails_with_current_error():
    with pytest.raises(ValueError, match="Could not detect IOC type"):
        detect_ioc(SHA256[:63])


def test_non_hex_hash_of_valid_length_is_rejected():
    with pytest.raises(ValueError, match="Could not detect IOC type"):
        detect_ioc("z" * 64)


@pytest.mark.parametrize("value", ["", "   ", "\n"])
def test_empty_is_rejected(value):
    with pytest.raises(ValueError, match="Empty IOC"):
        detect_ioc(value)


@pytest.mark.parametrize("value", ["999.999.999.999", "256.1.1.1", "1.2.3"])
def test_dotted_numbers_that_are_not_valid_ips_are_rejected(value):
    with pytest.raises(ValueError, match="Could not detect IOC type"):
        detect_ioc(value)


@pytest.mark.parametrize("value", ["notanioc", "localhost", "12345"])
def test_garbage_is_rejected(value):
    with pytest.raises(ValueError, match="Could not detect IOC type"):
        detect_ioc(value)
