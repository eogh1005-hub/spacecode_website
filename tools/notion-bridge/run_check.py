#!/usr/bin/env python3
"""번호 읽기 단위 테스트를 실행한다. 실패하면 0이 아닌 코드로 끝난다."""

from __future__ import annotations

import unittest
from pathlib import Path


def main() -> int:
    suite = unittest.defaultTestLoader.discover(
        start_dir=str(Path(__file__).resolve().parent),
        pattern="test_bridge.py",
    )
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
