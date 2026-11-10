Mã: RF-04
Mạch: RF - đưa repo về chuẩn handoff
Nối tiếp: RF-03
Người làm: claude
Người soát: codex
Trạng thái: chờ-soát
Vòng: 1/2

## ĐỀ BÀI
Kỳ vọng của user: "AOG Watcher. Cần cậu refract theo chuẩn mới của handoff standard v2" (user, 2026-10-28).
Mục tiêu: Đưa phòng bàn giao của repo từ handoff-standard v1.1 lên v2.0 theo mục 12 của chuẩn, để Claude và Codex làm việc ngang cấp trên cùng một bộ luật, mà không đổi hành vi extension.
Ngoài phạm vi:
- Không đổi hành vi, giao diện hay dữ liệu runtime của extension.
- Không đóng hộ V5-01, V5-02, RF-03; chỉ đổi khuôn.
Kế thừa:
- RF-03 đưa repo về v1.1: RULES ghi sinh từ v1.1, ảnh `shots/` đã đúng tên, README đã đủ mục.
Kịch bản test:
- User mở thư mục `handoff/`: thấy `RULES.md`, `STATE.md`, `MAP.md`, `docs/`, `shots/`, `done/`, `archive/`, đúng một bản `handoff-standard-v2.0.md`, và chỉ các phiếu đang mở nằm phẳng; RF-01, RF-02 nằm trong `done/`.
- Dòng đầu `RULES.md` ghi sinh từ handoff-standard v2.0; `RULES.md` dưới 200 dòng, `STATE.md` dưới 100 dòng, `AGENTS.md` dưới 30 dòng.
- Ngoài `archive/`, `done/` và bản chuẩn, không còn chữ `Chairman`, `Chỉ huy`, `claude-ceo`, `[COWORK-EXEC]`, `chờ-nghiệm-thu` trừ chỗ ghi lại chính việc đổi.
- `npm run check` vẫn đạt đúng 28 file test, 181 test như trước khi đổi.
- Tuyệt đối không: một file chức năng nào đổi hành vi.

## TODO
- [x] Đọc chuẩn v2.0 và toàn bộ phòng bàn giao hiện tại.
- [x] Chạy `npm run check` trước khi đổi (baseline).
- [x] Xác định repo không phải agentic (không có tác nhân AI chạy trong sản phẩm) → không tạo `memory/`, không tạo `CLAUDE.md`, không áp mục 14.
- [x] Tạo `done/`, chuyển RF-01, RF-02 vào.
- [x] Sinh lại `RULES.md`: chép nguyên văn mục 0, trạng thái và trần vòng lặp của mục 3, mục 9, 10, 11; giữ luật riêng còn đúng.
- [x] Viết lại `AGENTS.md` (tiếng Việt, 11 dòng) và `STATE.md` theo khuôn mục 5.
- [x] Đổi V5-01, V5-02, RF-03 sang khuôn phiếu mục 3.
- [x] Phiếu trong `done/`, `archive/README.md` và một chú thích trong `lib/constants.js`: chỉ đổi từ ngữ theo mục 11.
- [x] `MAP.md`: sửa nhãn runtime, sửa chỗ lệch hiện trạng (6 bảng SharePoint, không phải 5).
- [x] Chạy lại `npm run check` và quét từ ngữ, đường dẫn cũ.
- [ ] Người soát (codex) soát và chạy `npm run check` trên máy Windows.

## AUDIT
Báo cáo của người làm:
- File đổi:
  - Viết lại: `AGENTS.md`, `handoff/RULES.md`, `handoff/STATE.md`, `handoff/20260928_V5-01_nang-cap-dot1.md`, `handoff/20260928_V5-02_brand-theme-ui.md`, `handoff/20260929_RF-03_tuan-chuan-v1-1.md`.
  - Sửa một phần: `handoff/MAP.md`, `handoff/archive/README.md`, `lib/constants.js` (chỉ dòng chú thích `// Chairman 2026-09-29` → `// user 2026-09-29`).
  - Chuyển chỗ, chỉ đổi từ ngữ: `handoff/20260928_RF-01_reform-handoff.md` → `handoff/done/`, `handoff/20260928_RF-02_commit-and-cleanup.md` → `handoff/done/`.
  - Thêm: `handoff/done/`, phiếu này; `handoff/handoff-standard-v2.0.md` đã được user chép vào trước phiên.
  - Không có file nào trỏ tới đường dẫn cũ của RF-01, RF-02 ngoài chính RF-02 (dòng dán kết quả lệnh cũ, giữ nguyên vì đã ký).
- Luật cũ bị thay hoặc bỏ, vì mâu thuẫn bản v2.0:
  - "Chế độ chỉ huy" và `[COWORK-EXEC]` → thay bằng Claude và Codex ngang cấp, người làm và người soát (mục 0, 9).
  - "Claude không được đề xuất kiến trúc, thư viện, cấu trúc file" → bỏ; v2.0 cho cả hai bên quyết kiến trúc.
  - Quyền ký theo vai (`claude-ceo`, `claude-user`, `claude-logisticist`, Chairman ký nghiệm thu) → thay bằng luật bằng chứng mục 9; user không duyệt từng mốc.
  - "Bốn câu của Chairman" → thay bằng mục 10 (trả lời rồi/chưa trước, tự làm hỏng thử, nói rõ chỗ KHÔNG ĐO ĐƯỢC).
  - Trạng thái `chờ-nghiệm-thu`, `chờ-chairman` → `chờ-soát`, `chờ-user`; nhãn `[RUNTIME CHƯA KIỂM]` → `[RUNTIME UNVERIFIED]`.
  - "Trước patch lỗi phải có hypothesis card, sau patch phải sweep cùng shape" → bỏ khỏi RULES, vì v2.0 để quy trình kỹ thuật cho agent tự quyết.
  - "Một hướng điều tra không tìm thấy sau hai lượt thì dừng" → bỏ cùng lý do.
  - Luật phòng bàn giao chép tay (tên phiếu, tên ảnh, ngân sách đọc) → bỏ khỏi RULES; nằm ở chuẩn, RULES không chép phần ngoài mục 4 bắt buộc.
- Luật riêng giữ lại: 4 luật môi trường (đọc Git bằng `--no-optional-locks`, chạy test trên bản sao, unit test không thay ca đêm thật, xem giao diện qua http) và 6 luật sản phẩm.
- Lệnh và kết quả, chạy trong máy ảo Linux trên máy user, bản sao repo không kèm `node_modules` và `.git`, `npm ci`:

```text
# trước khi đổi
> npm run check
 Test Files  28 passed (28)
      Tests  181 passed (181)

# sau khi đổi
> npm run check
MV3 check passed (14 referenced files).
 Test Files  28 passed (28)
      Tests  181 passed (181)

> grep -rnE "Chairman|chairman|Chỉ huy|chỉ huy|claude-ceo|COWORK-EXEC|RUNTIME CHƯA KIỂM|chờ-nghiệm-thu|chờ-chairman|Giao cho:|Chuẩn Bàn Giao" (trừ node_modules, .git, archive, done, bản chuẩn, dòng ví dụ trong mục 11 của RULES)
./handoff/20260928_V5-01_nang-cap-dot1.md:120: (HISTORY ghi lại chính việc đổi tên)
./handoff/20260928_V5-02_brand-theme-ui.md:97: (HISTORY ghi lại chính việc đổi tên)

> grep -rnE "handoff/todo\.md|handoff/audit\.md|log/history|log/failure|log/sessions|handoff-standard-v1|RF-01_reform-handoff|RF-02_commit-and-cleanup" (trừ archive, bản chuẩn)
./handoff/20260929_RF-03_tuan-chuan-v1-1.md:10,20 (lời nguyên văn của user và việc đã làm trong RF-03)
./handoff/done/20260928_RF-01_reform-handoff.md:22 (Kế thừa đã ký)
./handoff/done/20260928_RF-02_commit-and-cleanup.md:63 (kết quả lệnh đã ký)

> wc -l handoff/RULES.md handoff/STATE.md handoff/MAP.md AGENTS.md
82 handoff/RULES.md / 31 handoff/STATE.md / 58 handoff/MAP.md / 11 AGENTS.md
```

- Lệnh quét biết đỏ: nó bắt đúng các dòng ghi lại việc đổi ở trên, nên một chữ cũ còn sót sẽ hiện ra.
- Phép thử chạy trên Linux, không phải Chrome/Edge trên Windows → `[RUNTIME UNVERIFIED]` cho máy Windows. Phiếu này chỉ đổi tài liệu và một dòng chú thích nên rủi ro thấp.
- Chưa commit Git: thư mục nối từ máy ảo không có quyền xoá file khoá của Git (bẫy đã gặp ở RF-02), nên commit để user hoặc codex làm trên Windows.
- Lệch so với đề bài: không.
- Câu hỏi còn treo cho user: cho đóng-huỷ RF-03 không (đã bị phiếu này thay).
-- claude - 2026-10-28 10:56 UTC+7

Giả định kỹ thuật:

```
[GIẢ ĐỊNH KỸ THUẬT] Repo không phải agentic: extension không có tác nhân AI chạy vòng lặp, nên không dựng `memory/`, `CLAUDE.md` và không chép mục 14.
Vì sao chọn: mã chỉ là state machine, bộ đếm giờ và đọc DOM; không có lời gọi mô hình AI nào.
Sai thì làm lại: tạo `CLAUDE.md`, `memory/` và chép mục 14 vào `RULES.md`.
```

```
[GIẢ ĐỊNH KỸ THUẬT] Giữ `handoff/docs/SPEC-aog-watcher-v43.md`; không chuyển vào `archive/`.
Vì sao chọn: baseline theo ca, phạm vi và bộ lọc Outlook, chẩn đoán nguồn, đánh thức theo trạng thái rảnh mô tả trong đó vẫn còn trong 5.0; riêng phần report pipeline đã bỏ ở 5.0.
Sai thì làm lại: chuyển file vào `handoff/archive/legacy-docs/`.
```

Soát:
Kết quả:

## HISTORY
### 2026-10-28
Failure: không.
Báo lỗi giả: không
Lessons: không.
-- claude - 2026-10-28 10:56 UTC+7
