"""Renders the hero's dot-art grid (art/hands.txt) into the field image src/hero/field.png.

The image channels carry what the page's scene reads:
R = painted light (dot weight), G = silhouette, B = fade toward the arm ends.
The metadata printed on stdout (grid size, cell size, fingertip positions) is the FIELD_META constant
in src/hero/field.js: paste it there when the art changes.

Command (from the repository root, Python 3 standard library only):
    python3 apps/site/scripts/hero-field.py
"""
import json, os, struct, zlib
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'art', 'hands.txt')
OUT = os.path.join(HERE, '..', 'src', 'hero')
W, H = 840, 200
CW, CH, X0, Y0 = 4.2, 7.92, 48.0, 5.0
rows = open(SRC, encoding='utf-8').read().split('\n')[:24]
COLS = 177
rows = [r.ljust(COLS) for r in rows]
occ = [[rows[r][c] != ' ' for c in range(COLS)] for r in range(24)]
def morph(g, grow):
    R, C = len(g), len(g[0]); o = [[False]*C for _ in range(R)]
    for r in range(R):
        for c in range(C):
            vals = [g[rr][cc] if 0 <= rr < R and 0 <= cc < C else (not grow)
                    for rr in range(r-1, r+2) for cc in range(c-1, c+2)]
            o[r][c] = any(vals) if grow else all(vals)
    return o
sol = morph(morph(occ, True), False)           # closing
# fill enclosed holes: flood the outside from the border
R, C = 24, COLS; out = [[False]*C for _ in range(R)]; st = []
for r in range(R):
    for c in range(C):
        if (r in (0, R-1) or c in (0, C-1)) and not sol[r][c]: out[r][c] = True; st.append((r, c))
while st:
    r, c = st.pop()
    for rr, cc in ((r+1, c), (r-1, c), (r, c+1), (r, c-1)):
        if 0 <= rr < R and 0 <= cc < C and not sol[rr][cc] and not out[rr][cc]: out[rr][cc] = True; st.append((rr, cc))
sol = [[not out[r][c] for c in range(C)] for r in range(R)]
# hands: left cols < split, right >= split (the empty column band between them)
colany = [any(sol[r][c] for r in range(R)) for c in range(C)]
gaps = [c for c in range(C) if not colany[c]]
mid = [c for c in gaps if 60 < c < 110]
lo, hi = min(mid), max(mid); gapcol = (lo + hi) / 2
leftmax = lo - 1; rightmin = hi + 1
def ys(c): return [r for r in range(R) if sol[r][c]]
tipL_r = sum(ys(leftmax)) / len(ys(leftmax)); tipR_r = sum(ys(rightmin)) / len(ys(rightmin))
cx = lambda c: X0 + (c + 0.5) * CW
cy = lambda r: Y0 + (r + 0.5) * CH
tipL = [cx(leftmax), cy(tipL_r)]; tipR = [cx(rightmin), cy(tipR_r)]
buf = [bytearray(W * 3) for _ in range(H)]
for r in range(R):
    for c in range(C):
        if not sol[r][c]: continue
        ch = rows[r][c]; light = 255 if ch == '•' else 110 if ch == '.' else 0
        d = abs(c - gapcol); f = 1 - max(0, min(1, (d - 44) / 40)); f = f * f * (3 - 2 * f); fade = int(8 + 247 * f)
        for y in range(int(Y0 + r * CH + 0.5), int(Y0 + (r + 1) * CH + 0.5)):
            for x in range(int(X0 + c * CW + 0.5), int(X0 + (c + 1) * CW + 0.5)):
                buf[y][x*3:x*3+3] = bytes((light, 255, fade))
raw = b''.join(b'\x00' + bytes(b) for b in buf)
def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
open(OUT + '/field.png', 'wb').write(png)
meta = {"w": W, "h": H, "adamMaxX": tipL[0], "tipL": tipL, "tipR": tipR, "cols": COLS, "rows": 24, "cw": CW, "ch": CH, "x0": X0, "y0": Y0}
print(json.dumps(meta))
