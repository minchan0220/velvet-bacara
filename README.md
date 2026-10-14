# Velvet Baccarat

가상칩 전용 바카라 데모입니다. 실제 입금/출금/환전 기능이 없습니다.

## 기능
- Player / Banker / Tie 베팅
- 8덱 슈 기반 카드 딜링
- 바카라 3번째 카드 규칙
- 카드 1장당 약 1.2초 간격
- 매 판 랜덤 Boost Card 8장
- 동일 Boost Card 중복 허용
- 실제 딜 카드와 정확히 일치하는 모든 Boost를 곱연산으로 누적
- 승리 시 승리 팀 + 순이익 표시
- 패배 시 `패배` 표시
- 무승부 반환 처리
- 모바일 UI
- localStorage 잔액/히스토리 저장

## 실행
```bash
npm install
npm run dev
```

## Vercel
GitHub 저장소에 파일을 올린 뒤 Vercel 프로젝트와 연결하면 자동 배포됩니다.
