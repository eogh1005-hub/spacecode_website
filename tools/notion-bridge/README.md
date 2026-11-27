# 실행 지시 번호 읽기

Notion `실행 지시` 본문을 이 스크립트에 넣으면, `목표:` 접두사가 없어도 `1.` `2.` `3.` 줄을 작은 번호부터 작업으로 돌려준다.

```bash
python3 tools/notion-bridge/bridge.py parse --file tools/notion-bridge/fixtures/formwork.txt
python3 tools/notion-bridge/run_check.py
```

`mode`가 `numbered`이면 `items`의 앞 항목부터 한다. `error`이면 실행하지 말고 `errors`를 보고한다. `empty`일 때만 할 일이 없다.
