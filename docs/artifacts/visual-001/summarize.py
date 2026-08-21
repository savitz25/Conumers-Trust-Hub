import json
from pathlib import Path

p = Path(__file__).with_name("measurements.json")
d = json.loads(p.read_text(encoding="utf-8"))
print("captured", d.get("capturedAt"))
for hub, data in d["hubs"].items():
    print("\n====", hub.upper(), "====")
    for vp in ("desktop", "mobile"):
        block = data.get(vp)
        home = block.get("home") if isinstance(block, dict) else None
        if not home:
            print(vp, "MISSING", data.get(vp + "Error") or block)
            continue
        h = home.get("header") or {}
        logo = home.get("logo") or {}
        h1 = home.get("h1") or {}
        btns = home.get("buttons") or []
        btn = btns[0] if btns else {}
        inp = home.get("input") or {}
        card = home.get("card") or {}
        print(
            f"{vp}: header {h.get('h')}x{h.get('w')} y={h.get('y')} font={h.get('font')} fs={h.get('fontSize')}"
        )
        print(f"  logo {logo.get('w')}x{logo.get('h')} at ({logo.get('x')},{logo.get('y')})")
        print(
            f"  gutter {home.get('leftGutter')} contentW {home.get('contentWidth')} body {home.get('bodyFont')} {home.get('bodySize')}"
        )
        print(f"  h1 {h1.get('fontSize')} {h1.get('fontWeight')} {h1.get('font')} h={h1.get('h')}")
        print(
            f"  firstBtn h={btn.get('h')} r={btn.get('radius')} fs={btn.get('fontSize')} '{btn.get('text')}'"
        )
        print(f"  input h={inp.get('h')} r={inp.get('radius')} card r={card.get('radius')} pad={card.get('padding')}")
        nav = " | ".join(x.get("text", "") for x in (home.get("navLinks") or [])[:8])
        print("  nav:", nav)
        print("  title:", home.get("title"))
