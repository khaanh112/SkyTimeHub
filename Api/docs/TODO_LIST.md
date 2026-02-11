xóa mail peding/processing dư thừa (outdated)
thêm hr defaul nhận mail
sửa format mail cho đẹp
sửa nghiệp vụ leave
xem xét mail khi cancelled request
làm department module, cấu hình approver trong đó
sửa import excel cho clean
thêm export
thực hiện ot module
hoàn thành settings module
sửa frontend
gửi mail tức thì (và cron nếu lỗi)

[Nest] 27224  - 02/11/2026, 5:30:55 PM   ERROR [UserApproverService] Failed to set approver for user ID: 44
QueryFailedError: duplicate key value violates unique constraint "uq_user_approver_active"
    at PostgresQueryRunner.query (D:\CV\SkyTimeHub\Api\node_modules\typeorm\driver\src\driver\postgres\PostgresQueryRunner.ts:325:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async UpdateQueryBuilder.execute (D:\CV\SkyTimeHub\Api\node_modules\typeorm\query-builder\src\query-builder\UpdateQueryBuilder.ts:145:33)
    at async UserApproverService.setApproverForUser (D:\CV\SkyTimeHub\Api\src\modules\settings\services\user-approver.service.ts:74:7)
[Nest] 27224  - 02/11/2026, 5:31:00 PM   DEBUG [EmailWorkerService] Starting email queue processing...
[Nest] 27224  - 02/11/2026, 5:31:00 PM   DEBUG [EmailWorkerService] 🔍 Looking for PENDING emails ready to process (next_retry_at <= 2026-02-11T10:31:00.016Z)
[Nest] 27224  - 02/11/2026, 5:31:00 PM   DEBUG [EmailWorkerService] No PENDING emails found ready for processing
[Nest] 27224  - 02/11/2026, 5:31:00 PM   DEBUG [EmailWorkerService] No pending emails to process
