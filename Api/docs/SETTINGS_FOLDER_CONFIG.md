src/modules/settings/
  settings.module.ts

  controllers/
    approver-config.controller.ts
    leave-policy.controller.ts
    ot-policy.controller.ts
    holidays.controller.ts

  services/
    approver-config.service.ts
    leave-policy.service.ts
    ot-policy.service.ts
    holidays.service.ts
    settings-read.service.ts        // (optional) gom logic đọc config + cache

  dto/
    approver-config/
      update-approver-config.dto.ts
      approver-config.response.dto.ts

    leave-policy/
      update-leave-policy.dto.ts
      leave-policy.response.dto.ts

    ot-policy/
      update-ot-policy.dto.ts
      ot-policy.response.dto.ts

    holidays/
      upsert-holidays.dto.ts
      holiday.response.dto.ts

  entities/
    approver_config.entity.ts        // hoặc settings_kv.entity.ts (nếu làm key-value)
    leave_policy.entity.ts
    ot_policy.entity.ts
    holiday.entity.ts
    settings_audit_log.entity.ts     // (khuyên) log ai đổi config gì

  enums/
    approver-level.enum.ts           // EMPLOYEE_REQUEST, DEPT_LEAD_REQUEST...
    policy-scope.enum.ts             // (nếu cần)

  repositories/                     // optional, chỉ khi query phức tạp
    holiday.repository.ts

  validators/                       // optional, custom validation
    no-self-approval.validator.ts

  index.ts                          // optional export barrel
