"""Production social-metadata probe for SHARE-002. Not imported by the app."""
from __future__ import annotations

import argparse
import json
import re
import ssl
import struct
import urllib.request

CTX = ssl.create_default_context()

UAS = {
    "facebook": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "twitter": "Twitterbot/1.0",
    "slack": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "browser": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
}

META_RE = re.compile(r"<meta\b[^>]*>", re.I)
PROP_RE = re.compile(r"""(?:property|name)\s*=\s*["']([^"']+)["']""", re.I)
CONTENT_RE = re.compile(r"""content\s*=\s*["']([^"']*)["']""", re.I)
CANONICAL_RE = re.compile(
    r"""<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>""",
    re.I,
)
HREF_RE = re.compile(r"""href\s*=\s*["']([^"']+)["']""", re.I)


def fetch(url: str, ua: str) -> tuple[int, str, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "text/html"})
    with urllib.request.urlopen(req, context=CTX, timeout=30) as response:
        return response.status, response.geturl(), response.read()


def parse_meta(html: bytes) -> dict[str, list[str]]:
    text = html.decode("utf-8", "replace")
    out: dict[str, list[str]] = {}
    for tag in META_RE.findall(text):
        prop = PROP_RE.search(tag)
        content = CONTENT_RE.search(tag)
        if prop and content:
            out.setdefault(prop.group(1).lower(), []).append(content.group(1))
    for tag in CANONICAL_RE.findall(text):
        href = HREF_RE.search(tag)
        if href:
            out.setdefault("canonical", []).append(href.group(1))
    return out


def png_info(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UAS["facebook"]})
    with urllib.request.urlopen(req, context=CTX, timeout=30) as response:
        data = response.read()
        status = response.status
    width = height = None
    if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 24:
        width, height = struct.unpack(">II", data[16:24])
    return {"status": status, "width": width, "height": height, "bytes": len(data)}


def scan_forbidden(values: list[str], extra: list[str]) -> list[str]:
    blob = " ".join(values).lower()
    hits = []
    for token in extra:
        if token.lower() in blob:
            hits.append(token)
    return hits


def probe(url: str, expected_host: str, foreign_hosts: list[str]) -> dict:
    result = {"url": url, "expected_host": expected_host, "agents": {}}
    forbidden = ["localhost", "127.0.0.1", ".vercel.app", *foreign_hosts]
    for name, ua in UAS.items():
        status, final, body = fetch(url, ua)
        meta = parse_meta(body)
        agent = {
            "http": status,
            "final": final,
            "og:title": meta.get("og:title", []),
            "og:description": meta.get("og:description", []),
            "og:image": meta.get("og:image", []),
            "og:url": meta.get("og:url", []),
            "og:site_name": meta.get("og:site_name", []),
            "twitter:card": meta.get("twitter:card", []),
            "twitter:image": meta.get("twitter:image", meta.get("twitter:image:src", [])),
            "canonical": meta.get("canonical", []),
        }
        meta_vals = [v for vs in agent.values() if isinstance(vs, list) for v in vs]
        meta_vals.append(final)
        agent["forbidden"] = scan_forbidden(meta_vals, forbidden)
        agent["host_ok"] = expected_host in " ".join(meta_vals)
        if name == "facebook" and agent["og:image"]:
            agent["image"] = png_info(agent["og:image"][0])
        result["agents"][name] = agent
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("urls", nargs="+")
    parser.add_argument("--host", required=True)
    parser.add_argument("--foreign", default="")
    args = parser.parse_args()
    foreign = [item for item in args.foreign.split(",") if item]
    payload = [probe(url, args.host, foreign) for url in args.urls]
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
