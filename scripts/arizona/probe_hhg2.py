#!/usr/bin/env python3
import json, ssl, urllib.parse, urllib.request
CTX = ssl.create_default_context()
url = "https://data.transportation.gov/resource/az4n-8mr2.json?" + urllib.parse.urlencode({"$limit": "1", "phy_state": "AZ"})
req = urllib.request.Request(url, headers={"User-Agent": "AskTrustHub-ATH-AZ-001/1.0"})
with urllib.request.urlopen(req, timeout=60, context=CTX) as resp:
    row = json.loads(resp.read().decode())[0]
print("\n".join(sorted(row.keys())))
print("---")
for k, v in sorted(row.items()):
    if v not in (None, "", "0"):
        print(k, "=", v)
