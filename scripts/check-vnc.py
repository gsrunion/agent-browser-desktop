#!/usr/bin/env python3
"""Read a small framebuffer region over VNC; no third-party packages needed."""
import argparse
import socket
import struct

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--host", default="127.0.0.1")
parser.add_argument("--port", type=int, default=5901)
parser.add_argument("--type-test", action="store_true", help="Type vnc-control into the MCP smoke-test page")
args = parser.parse_args()

with socket.create_connection((args.host, args.port), timeout=10) as sock:
    def read(size):
        result = bytearray()
        while len(result) < size:
            chunk = sock.recv(size - len(result))
            if not chunk:
                raise RuntimeError("VNC connection closed unexpectedly")
            result.extend(chunk)
        return bytes(result)

    assert read(12) == b"RFB 003.008\n"
    sock.sendall(b"RFB 003.008\n")
    count = read(1)[0]
    assert count > 0, "Server rejected connection"
    assert 1 in read(count), "Expected SSH-protected, no-password VNC"
    sock.sendall(b"\x01")
    assert struct.unpack(">I", read(4))[0] == 0
    sock.sendall(b"\x01")  # Shared desktop
    init = read(24)
    width, height = struct.unpack(">HH", init[:4])
    bytes_per_pixel = init[4] // 8
    name = read(struct.unpack(">I", init[20:24])[0]).decode(errors="replace")
    assert (width, height) == (1440, 900), (width, height)
    sock.sendall(struct.pack(">BBHi", 2, 0, 1, 0))  # Raw encoding only
    sock.sendall(struct.pack(">BBHHHH", 3, 0, 0, 0, 64, 64))
    assert read(1) == b"\x00", "Expected a framebuffer update"
    read(1)
    rectangles = struct.unpack(">H", read(2))[0]
    assert rectangles > 0
    total = 0
    for _ in range(rectangles):
        x, y, w, h, encoding = struct.unpack(">HHHHi", read(12))
        assert encoding == 0, encoding
        total += len(read(w * h * bytes_per_pixel))
    assert total > 0
    print(f"PASS: VNC shared desktop {width}x{height}; {total} framebuffer bytes ({name})")
    if args.type_test:
        for char in "vnc-control":
            sock.sendall(struct.pack(">BBHI", 4, 1, 0, ord(char)))
            sock.sendall(struct.pack(">BBHI", 4, 0, 0, ord(char)))
        print("Sent keyboard input; verify it with smoke.mjs --verify-vnc")
