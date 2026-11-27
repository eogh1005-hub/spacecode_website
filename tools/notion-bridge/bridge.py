#!/usr/bin/env python3
"""실행 지시 본문에서 번호 메모를 읽는다.

2026-10-10 자동화는 '목표:'로 시작하는 줄만 목표로 봤다.
번호 목록은 목표가 없는 것으로 버려져 Cursor에 전달되지 않았다.
이 스크립트는 번호 줄을 작은 번호부터 작업으로 돌려준다.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")
GOAL_LINE = re.compile(r"^\s*목표\s*[:：]\s*(.*?)\s*$")
# 줄 시작만 메모다. 같은 줄 중간의 '1.' '2.'는 그 메모의 내용이다.
NUMBERED_LINE = re.compile(
    r"""
    ^\s*
    (?:[-*]\s+)?
    (?:
        \[\s*(\d{1,4})\s*\]
        |
        [\(（]\s*(\d{1,4})\s*[\)）]
        |
        (\d{1,4})\s*(?:[\.\)）:：、]|-(?!\d))
    )
    \s*
    (.*)$
    """,
    re.VERBOSE,
)


def _normalize(line: str) -> str:
    return line.translate(FULLWIDTH_DIGITS).replace("\u00a0", " ")


def _number_from_match(match: re.Match[str]) -> int:
    raw = next(group for group in match.groups()[:3] if group is not None)
    return int(raw)


def parse_instruction(text: str) -> dict:
    """실행 지시 본문을 작업 목록으로 바꾼다.

    번호 줄이 하나라도 있으면 그 줄만 작업이다. '목표:' 줄은 실행하지 않는다.
    번호가 전혀 없을 때만 맨 위 '목표:' 줄 하나를 이전 형식으로 본다.
    같은 번호가 두 번이면 실행하지 않고 duplicates를 채운다.
    """
    items: list[dict] = []
    seen: dict[int, str] = {}
    duplicates: list[int] = []
    goal_lines: list[str] = []
    current: dict | None = None

    for raw_line in text.splitlines():
        line = _normalize(raw_line).rstrip()
        if not line.strip():
            if current is not None:
                current["text"] = current["text"].rstrip()
            continue

        numbered = NUMBERED_LINE.match(line)
        if numbered:
            number = _number_from_match(numbered)
            body = numbered.group(4).strip()
            if number in seen:
                if number not in duplicates:
                    duplicates.append(number)
            else:
                seen[number] = body
            current = {"number": number, "text": body}
            items.append(current)
            continue

        goal = GOAL_LINE.match(line)
        if goal and goal.group(1):
            goal_lines.append(goal.group(1).strip())
            current = None
            continue

        if current is not None:
            extra = line.strip()
            current["text"] = (current["text"] + "\n" + extra).strip()

    if duplicates:
        return {
            "mode": "error",
            "items": [],
            "ignored_goal_lines": goal_lines,
            "duplicates": duplicates,
            "errors": [
                "같은 번호가 둘 이상이다. 실행하지 말고 중복 번호를 보고한다: "
                + ", ".join(str(number) for number in duplicates)
            ],
        }

    if items:
        ordered = sorted(items, key=lambda item: item["number"])
        return {
            "mode": "numbered",
            "items": ordered,
            "ignored_goal_lines": goal_lines,
            "duplicates": [],
            "errors": [],
        }

    if goal_lines:
        return {
            "mode": "legacy",
            "items": [{"number": None, "text": goal_lines[0]}],
            "ignored_goal_lines": goal_lines[1:],
            "duplicates": [],
            "errors": [],
        }

    return {
        "mode": "empty",
        "items": [],
        "ignored_goal_lines": [],
        "duplicates": [],
        "errors": [],
    }


def old_prompt_would_skip(text: str) -> bool:
    """예전 자동화가 이 본문을 '목표 없음'으로 버렸는지."""
    for raw_line in text.splitlines():
        if GOAL_LINE.match(_normalize(raw_line)):
            return False
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="실행 지시 번호 메모를 읽는다")
    parser.add_argument("command", choices=["parse"])
    parser.add_argument("--file", type=Path, help="본문 파일. 없으면 표준 입력")
    args = parser.parse_args(argv)

    if args.file:
        text = args.file.read_text(encoding="utf-8")
    else:
        text = sys.stdin.read()

    result = parse_instruction(text)
    result["old_prompt_would_skip"] = old_prompt_would_skip(text) and result["mode"] == "numbered"
    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    if result["mode"] == "error":
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
