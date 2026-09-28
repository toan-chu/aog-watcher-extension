Cập nhật:  2026-09-28 16:45 UTC+7 - bởi claude
Chỉ huy:   claude [COWORK-EXEC] (Codex bận, Chairman giải trừ 2026-09-28)

## Việc đang mở

V5-01  chờ-nghiệm-thu  AOG Watcher 5.0.0 (code xong, 176/176 test; runtime chưa kiểm)
V5-02  mở             Theme Trustana + dựng lại bố cục popup/Cài đặt (làm tiếp 2026-09-29)

## Hôm qua

- Repo ở bản 4.3.0 với 133 test tự động.
- Cấu trúc điều phối cũ gom nhiều round vào bốn file phẳng.
- V4.3 đã code xong nhưng chưa có bằng chứng manual overnight test trong môi trường thật.

## Vừa đóng

RF-01  đóng-đạt  2026-09-28
RF-02  đóng-đạt  2026-09-28

## Đang treo, cần Chairman

- V5-01: gửi link site SharePoint AOG; nghiệm thu runtime KS-1..KS-8 trên 2 máy thật.
- V5-02: chốt font (Roboto/Calibri theo guideline hay Montserrat/Quicksand); duyệt kịch bản nháp.
- Import `handoff-standard` vào tài liệu Project; `RULES.md` chưa ghi sinh từ phiên bản chuẩn nào.

## Bẫy đã biết

- Reload MV3 có thể để lại content script cũ; runtime call dài hạn phải đi qua guard.
- Active-user wake gating không được dừng escalation timer.
- Baseline phải được tái sử dụng khi reload tab giữa ca.
- 5.0: nguồn vừa gửi alert được tính là còn sống; đừng chỉ dựa vào nhịp CONTENT_HEALTH.
- 5.0: dòng ca trực dùng chung 2 máy → luôn upsert vào dòng CŨ NHẤT của đêm (shared: true).

## Báo lỗi giả

Tháng này: 0
