Mã:         RF-01
Mạch:       RF - reform handoff
Nối tiếp:
Giao cho:   codex
Trạng thái: đóng-đạt
Vòng:       1/2

## ĐỀ BÀI

**Mục tiêu nghiệp vụ**

Dọn repo AOG Watcher sang cấu trúc handoff mới để sẵn sàng nhận ý tưởng tiếp theo, trong khi giữ nguyên chức năng hiện tại của extension.

**Ngoài phạm vi**

- Không thay đổi hành vi, giao diện, quy trình trực hay dữ liệu runtime của extension.
- Không triển khai tính năng mới.

**Kế thừa**

- Repo đang ở v4.3.0; baseline `npm run check` đạt 25 file test, 133 test.
- Cấu trúc cũ còn `handoff/todo.md`, `handoff/audit.md`, `log/history.md`, `log/failure.md`.

**Kịch bản nghiệm thu**

Chairman mở repo sau khi dọn dẹp: chỉ còn một phòng điều phối theo chuẩn mới, tài liệu cũ có nơi tra cứu rõ ràng, và extension vẫn vượt cùng lệnh kiểm tra như trước. Không file chức năng nào được thay đổi.

## TODO

- [x] Liệt kê toàn bộ dấu vết handoff legacy và lập mapping.
- [x] Chạy baseline kiểm tra trước reform.
- [x] Tạo router `AGENTS.md` và bộ `RULES.md`, `STATE.md`, `MAP.md`.
- [x] Phân loại tài liệu hiện hành và di chuyển legacy vào archive.
- [x] Xác định `memory/` có phải runtime memory của sản phẩm hay không.
- [x] Chuẩn hóa README cho người không chuyên.
- [x] Sweep toàn repo tìm đường dẫn legacy còn sót.
- [x] Chạy lại kiểm tra và xác minh diff không đổi file chức năng.
- [x] Bàn giao chờ nghiệm thu.
- [x] Theo override của Chairman, archive scaffold `memory/` cũ và cập nhật snapshot.

## AUDIT

### Hypothesis card

- Hypothesis: reform chỉ đổi tài liệu và vị trí file điều phối thì không ảnh hưởng chức năng extension.
- Cách kiểm tra: chạy `npm run check` trước/sau, so sánh Git diff và quét các đường dẫn legacy.
- Kết quả ban đầu: `npm run check` đạt; MV3 check pass 14 file, 25/25 file test và 133/133 test đạt.

### Ghi chú trước thao tác

- Việc gì: di chuyển các tài liệu legacy, trong đó có hơn 10 file và file lớn hơn 5 KB.
- Lý do: hợp nhất repo vào một phòng handoff v3.0, giữ khu vực làm việc hiện hành gọn và không tái tạo file đã retire.
- Blast radius: chỉ file Markdown/CSV/XLSX phục vụ tài liệu và phòng điều phối; không chạm vào JS, HTML, CSS, manifest, assets, tests hay `memory/source/`.
- Rollback: dùng lịch sử Git hoặc chuyển ngược từ `handoff/archive/` theo mapping được ghi trong ticket này.

### Bổ sung sau bàn giao

- Authorization: Chairman ngày 2026-09-28 cho phép đưa các file/folder cũ, bao gồm scaffold `memory/source/`, vào archive để repo về form mới.
- Hypothesis: `memory/` chỉ là scaffold rỗng, không phải runtime dependency; archive nguyên trạng sẽ không đổi chức năng extension.
- Cách kiểm tra: quét consumer ngoài handoff/memory, đối chiếu Git blob trước/sau move, kiểm tra functional diff và chạy `npm run check`.
- Kết quả trước thao tác: Git chỉ theo dõi bốn README scaffold; quét product source không có consumer nào tham chiếu `memory/`.
- Blast radius: bốn README dưới scaffold `memory/`; không động đến browser storage hay bất kỳ file runtime nào.
- Rollback: chuyển nguyên folder từ `handoff/archive/legacy-scaffold/memory/` về root `memory/`; Git blob được đối chiếu để bảo toàn.

### Report from the executor

**Đã làm**

- Tạo root `AGENTS.md`; tạo `handoff/RULES.md`, `STATE.md`, `MAP.md`, `docs/`, `shots/`, `archive/` và ticket RF-01.
- Di chuyển bốn file coordination đã retire và 15 artifact cũ vào archive; 19/19 file archive khớp nguyên Git blob cũ.
- Giữ `docs/SOP.md` là tài liệu sản phẩm; chuyển blueprint v4.3 thành `handoff/docs/SPEC-aog-watcher-v43.md` và chỉ cập nhật status đã implement.
- Chuẩn hóa README theo luồng nghiệp vụ, role table, cài đặt, cách dùng và xử lý lỗi.
- Xác định `memory/` không được code tham chiếu và sản phẩm không có agent loop. Sau override của Chairman, đã chuyển nguyên scaffold vào `handoff/archive/legacy-scaffold/memory/`; 4/4 Git blob khớp bản gốc.

**Lệnh và output**

```text
> npm run check
MV3 check passed (14 referenced files).
Test Files  25 passed (25)
Tests       133 passed (133)
```

Kết quả trên giống nhau trước và sau reform.

```text
> negative control: nạp tools/check_extension.mjs với manifest in-memory có manifest_version=2
exit code 1
Error: manifest_version must be 3
```

```text
> git diff --name-only | functional-file filter
(không có output)
> git diff --exit-code -- memory/source
memory/source: UNCHANGED
> hash archived files against HEAD blobs
23/23 MATCH
```

Sweep ngoài archive chỉ còn hai nhắc đúng chủ ý: lệnh cấm tái tạo trong `AGENTS.md` và bằng chứng cấu trúc cũ trong ticket này. Không còn consumer nào trỏ tới file legacy.

**Sai lệch so với ĐỀ BÀI:** none.

**Câu hỏi mở cho Chairman:** có mở ticket riêng cho live overnight acceptance v4.3 hay không.

### Claude's review

Chưa có.

### Acceptance signature

ĐẠT - Chairman xác nhận repo đã về scaffold handoff mới, legacy được archive và không có thay đổi chức năng.

-- chairman - 2026-09-28 10:56 UTC+7

## HISTORY

### 2026-09-28

Failure: lần `apply_patch` đầu tiên gộp xóa và thêm lại README trong một patch bị tool từ chối; patch không áp dụng nên không có dữ liệu bị ảnh hưởng.

Báo lỗi giả: không.

Lessons: thay thế toàn bộ một file qua `apply_patch` cần tách thao tác delete và add. Không cần đưa lên `RULES.md` vì đây là giới hạn cụ thể của tool, không phải luật sản phẩm.

-- codex - 2026-09-28 10:38 UTC+7
