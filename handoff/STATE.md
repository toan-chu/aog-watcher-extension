Cập nhật:  2026-09-29 10:58 UTC+7 - bởi claude-ceo
Chỉ huy:   claude [COWORK-EXEC] (Codex bận, Chairman giải trừ 2026-09-28)

## Việc đang mở

V5-01  chờ-nghiệm-thu  AOG Watcher 5.0.0 (code xong, 176/176 test; runtime chưa kiểm)
V5-02  chờ-nghiệm-thu  vòng 2/2  Popup nền trắng theo Trustana (ảnh shots/…V5-02_05..07)
RF-03  chờ-nghiệm-thu  vòng 1/2  Tuân Chuẩn Bàn Giao v1.1

## Hôm qua

- Repo ở bản 4.3.0 với 133 test tự động.
- Cấu trúc điều phối cũ gom nhiều round vào bốn file phẳng.
- V4.3 đã code xong nhưng chưa có bằng chứng manual overnight test trong môi trường thật.

## Vừa đóng

RF-01  đóng-đạt  2026-09-28
RF-02  đóng-đạt  2026-09-28

## Đang treo, cần Chairman

- V5-01: tạo 6 bảng AOG_* trên site cx9; nghiệm thu runtime KS-1..KS-8 trên 2 máy thật.
- V5-02: mở popup trên máy thật (nền trắng có chói lúc nửa đêm không?).
- RF-03: giữ mã mạch V5 hay đổi mã chữ cho phiếu sau; ký RF-03.
- Import `handoff-standard` vào tài liệu Project; `RULES.md` chưa ghi sinh từ phiên bản chuẩn nào.

## Bẫy đã biết

- Reload MV3 có thể để lại content script cũ; runtime call dài hạn phải đi qua guard.
- Active-user wake gating không được dừng escalation timer.
- Baseline phải được tái sử dụng khi reload tab giữa ca.
- 5.0: nguồn vừa gửi alert được tính là còn sống; đừng chỉ dựa vào nhịp CONTENT_HEALTH.
- 5.0: dòng ca trực dùng chung 2 máy → luôn upsert vào dòng CŨ NHẤT của đêm (shared: true).

## Báo lỗi giả

Tháng này: 0
