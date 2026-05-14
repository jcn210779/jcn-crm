"""Gera PNGs minimos pro PWA usando so stdlib (zlib + struct).

Sem dependencia de PIL/sharp. Saida: public/icon-192.png e public/icon-512.png.

Design: circulo com gradient amber->orange + letra "J" carvada (cor dark).
Background do PNG: dark base #0a0a0a (mesmo do tema).
"""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public"

BG = (10, 10, 10)           # #0a0a0a
PRIMARY = (250, 204, 21)    # amber
SECONDARY = (249, 115, 22)  # orange


def gen_png(size: int) -> bytes:
    cx, cy = size / 2, size / 2
    rmax = size * 0.42
    rmax_sq = rmax * rmax

    j_top = (int(size * 0.34), int(size * 0.32), int(size * 0.66), int(size * 0.40))
    j_stem = (int(size * 0.54), int(size * 0.32), int(size * 0.62), int(size * 0.62))
    j_hook = (int(size * 0.34), int(size * 0.58), int(size * 0.62), int(size * 0.66))
    j_hook_l = (int(size * 0.34), int(size * 0.50), int(size * 0.42), int(size * 0.66))

    def in_rect(x: int, y: int, r: tuple[int, int, int, int]) -> bool:
        return r[0] <= x <= r[2] and r[1] <= y <= r[3]

    rows: list[bytes] = []
    for y in range(size):
        row = bytearray([0])  # PNG filter byte
        for x in range(size):
            dx = x - cx
            dy = y - cy
            if dx * dx + dy * dy <= rmax_sq:
                t = y / size
                r = int(PRIMARY[0] * (1 - t) + SECONDARY[0] * t)
                g = int(PRIMARY[1] * (1 - t) + SECONDARY[1] * t)
                b = int(PRIMARY[2] * (1 - t) + SECONDARY[2] * t)
                if (
                    in_rect(x, y, j_top)
                    or in_rect(x, y, j_stem)
                    or in_rect(x, y, j_hook)
                    or in_rect(x, y, j_hook_l)
                ):
                    row += bytes(BG)
                else:
                    row += bytes((r, g, b))
            else:
                row += bytes(BG)
        rows.append(bytes(row))

    raw = b"".join(rows)
    compressed = zlib.compress(raw, 9)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for sz, name in [(192, "icon-192.png"), (512, "icon-512.png")]:
        target = OUT_DIR / name
        data = gen_png(sz)
        target.write_bytes(data)
        print(f"wrote {target} ({len(data)} bytes, {sz}x{sz})")


if __name__ == "__main__":
    main()
