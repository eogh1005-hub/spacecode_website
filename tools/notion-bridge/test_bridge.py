#!/usr/bin/env python3
"""번호 메모가 목표: 없이도 작은 번호부터 잡히는지 확인한다."""

from __future__ import annotations

import unittest
from pathlib import Path

from bridge import old_prompt_would_skip, parse_instruction

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"


class ParseInstructionTest(unittest.TestCase):
    def test_news_numbers_survive_missing_goal_prefix(self) -> None:
        text = (FIXTURES / "news.txt").read_text(encoding="utf-8")
        result = parse_instruction(text)
        self.assertTrue(old_prompt_would_skip(text))
        self.assertEqual(result["mode"], "numbered")
        self.assertEqual([item["number"] for item in result["items"]], [1, 2, 3, 4])
        self.assertIn("육하원칙", result["items"][0]["text"])
        self.assertEqual(result["errors"], [])

    def test_formwork_keeps_inline_numbers_inside_item_13(self) -> None:
        text = (FIXTURES / "formwork.txt").read_text(encoding="utf-8")
        result = parse_instruction(text)
        self.assertTrue(old_prompt_would_skip(text))
        self.assertEqual(result["mode"], "numbered")
        self.assertEqual([item["number"] for item in result["items"]], list(range(1, 14)))
        last = result["items"][-1]["text"]
        self.assertIn("1. rhinoceros", last)
        self.assertIn("2. 3D프린터", last)
        self.assertIn("3. Revit", last)

    def test_sorts_by_number_not_page_order(self) -> None:
        result = parse_instruction("10. 열째\n2. 둘째\n1. 첫째\n")
        self.assertEqual([item["number"] for item in result["items"]], [1, 2, 10])

    def test_numbered_list_beats_goal_prefix(self) -> None:
        result = parse_instruction("목표: 이 줄은 실행하지 않는다\n2. 둘째\n1. 첫째\n")
        self.assertEqual(result["mode"], "numbered")
        self.assertEqual([item["text"] for item in result["items"]], ["첫째", "둘째"])
        self.assertEqual(result["ignored_goal_lines"], ["이 줄은 실행하지 않는다"])

    def test_legacy_goal_when_no_numbers(self) -> None:
        result = parse_instruction("설명 문장\n목표: 하나만\n목표: 둘째는 무시\n")
        self.assertEqual(result["mode"], "legacy")
        self.assertEqual(result["items"], [{"number": None, "text": "하나만"}])
        self.assertFalse(old_prompt_would_skip("목표: 하나만\n"))

    def test_duplicate_numbers_do_not_run(self) -> None:
        result = parse_instruction("1. 하나\n1. 또 하나\n2. 둘\n")
        self.assertEqual(result["mode"], "error")
        self.assertEqual(result["items"], [])
        self.assertEqual(result["duplicates"], [1])

    def test_marker_shapes_and_fullwidth_digits(self) -> None:
        text = "１) 전각\n(2) 괄호\n[3] 대괄호\n4: 콜론\n5- 하이픈\n"
        result = parse_instruction(text)
        self.assertEqual([item["number"] for item in result["items"]], [1, 2, 3, 4, 5])
        self.assertEqual(result["items"][0]["text"], "전각")

    def test_date_like_line_is_not_a_memo(self) -> None:
        result = parse_instruction("2026-10-11 기록\n1. 실제 할 일\n")
        self.assertEqual(result["items"], [{"number": 1, "text": "실제 할 일"}])

    def test_continuation_stays_with_previous_number(self) -> None:
        result = parse_instruction("1. 첫째\n이어지는 설명\n2. 둘째\n")
        self.assertEqual(result["items"][0]["text"], "첫째\n이어지는 설명")

    def test_empty_and_stale_no_goal_label_are_not_work(self) -> None:
        result = parse_instruction("목표 없음\n상황 설명만 있다\n")
        self.assertEqual(result["mode"], "empty")
        self.assertEqual(result["items"], [])


if __name__ == "__main__":
    unittest.main()
