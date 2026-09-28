Mã:         RF-02
Mạch:       RF - reform handoff
Nối tiếp:   RF-01
Giao cho:   claude [COWORK-EXEC]
Trạng thái: đóng-đạt
Vòng:       1/2

## ĐỀ BÀI

**Mục tiêu nghiệp vụ**

Chốt sổ phần reform RF-01 vào lịch sử repo và dọn nốt luật đã hết hiệu lực, để repo sạch trước khi mở đợt nâng cấp AOG Watcher.

**Ngoài phạm vi**

- Không thay đổi hành vi, giao diện hay dữ liệu runtime của extension.
- Không bắt đầu tính năng mới.

**Kế thừa**

- RF-01 đã `đóng-đạt` nhưng toàn bộ thay đổi còn nằm ngoài lịch sử Git.
- `RULES.md` còn luật về `memory/source/`, thư mục đã được archive trong RF-01.

**Kịch bản nghiệm thu**

Chairman xem repo: lịch sử có một mốc riêng cho reform RF-01, không còn thay đổi nào treo ngoài Git, luật chết đã gỡ, extension vẫn qua cùng lệnh kiểm tra. Không file chức năng nào bị đổi. (Chairman giao bằng lời ngày 2026-09-28: "dọn dẹp rồi ký chung".)

## TODO

- [x] Chạy `npm run check` trên bản sao sạch trước khi commit.
- [x] Commit nguyên trạng reform RF-01 (commit `f84eeaa`).
- [x] Gỡ luật `memory/source/` khỏi `RULES.md`.
- [x] Ghi quy tắc giải trừ `[COWORK-EXEC]` vào `RULES.md`.
- [x] Cập nhật `STATE.md`.
- [x] Chairman ký nghiệm thu chung.

## AUDIT

### Ghi chú trước thao tác

- Blast radius: chỉ lịch sử Git và hai file `handoff/RULES.md`, `handoff/STATE.md`, cộng ticket này.
- Rollback: `git revert` commit RF-02; commit RF-01 giữ nguyên nội dung Codex đã bàn giao.

### Report from the executor

**Đã làm**

- Commit reform RF-01 nguyên trạng, không sửa nội dung: 7 file thêm, 1 file sửa (README), 24 file đổi chỗ vào archive.
- Gỡ luật `memory/source/` đã hết hiệu lực; thêm quy tắc giải trừ `[COWORK-EXEC]` theo yêu cầu Chairman.
- `STATE.md`: chỉ huy chuyển sang `claude [COWORK-EXEC]` cho đợt nâng cấp sắp mở.

**Lệnh và output**

```text
> npm run check   (bản sao sạch, npm ci trên Linux, không đụng node_modules của máy Windows)
Test Files  25 passed (25)
Tests       133 passed (133)
> git status --short | wc -l   (sau commit RF-01)
0
> git diff --name-only   (RF-02)
handoff/RULES.md
handoff/STATE.md
handoff/20260928_RF-02_commit-and-cleanup.md
```

`[RUNTIME CHƯA KIỂM]` Kiểm tra chạy trên Linux, chưa chạy lại trên máy Windows. Không có file chức năng thay đổi nên rủi ro thấp.

**Sai lệch so với ĐỀ BÀI:** none.

### Acceptance signature

ĐẠT - Chairman ủy quyền bằng lời trong hội thoại 2026-09-28 ("Ký giúp tôi"); claude ghi hộ.

-- chairman (claude ghi hộ) - 2026-09-28

## HISTORY

### 2026-09-28

Failure: lệnh `git status` đầu phiên chạy trong môi trường không có quyền xoá, để lại `.git/index.lock` rỗng. Đã xin quyền xoá và xoá đúng file đó; sau đó mọi lệnh đọc Git dùng `--no-optional-locks`.

Failure: `npm run check` trong thư mục repo hỏng vì `node_modules` là bản cài cho Windows. Chạy trên bản sao sạch thay vì cài lại vào thư mục của Chairman.

Báo lỗi giả: không.

Lessons: phiên chạy từ môi trường Linux phải đọc Git bằng `--no-optional-locks` và chạy test trên bản sao riêng.

-- claude - 2026-09-28 15:20 UTC+7
