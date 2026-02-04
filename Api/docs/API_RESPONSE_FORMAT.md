# API Response Format - Hướng dẫn sử dụng

## Tổng quan

Hệ thống API đã được đồng bộ với format response thống nhất cho cả success và error responses. Tất cả các API endpoints sẽ tự động được wrap vào format chuẩn.

## Format Response

### Success Response

```typescript
{
  "success": true,
  "data": <any>,           // Dữ liệu trả về
  "message": "string",     // (Optional) Thông báo bổ sung
  "timestamp": "string",   // ISO 8601 timestamp
  "path": "string"         // API endpoint path
}
```

### Error Response

```typescript
{
  "success": false,
  "code": "string",        // Mã lỗi (ErrorCode enum)
  "message": "string",     // Thông báo lỗi
  "details": <any>,        // (Optional) Chi tiết lỗi
  "timestamp": "string",   // ISO 8601 timestamp
  "path": "string"         // API endpoint path
}
```

## Cách sử dụng trong Controllers

### Tự động (Khuyến nghị)

Hầu hết trường hợp, bạn chỉ cần return data trực tiếp. `TransformInterceptor` sẽ tự động wrap vào format chuẩn:

```typescript
@Get()
async getUsers(): Promise<User[]> {
  return await this.usersService.getUsers();
  // Response sẽ tự động thành:
  // {
  //   "success": true,
  //   "data": [...users],
  //   "timestamp": "2026-02-03T10:00:00.000Z",
  //   "path": "/users"
  // }
}
```

### Thủ công (Khi cần custom message)

Nếu muốn thêm message tùy chỉnh, sử dụng `SuccessResponseDto`:

```typescript
import { SuccessResponseDto } from '@common/dto';

@Post()
async createUser(@Body() dto: CreateUserDto): Promise<SuccessResponseDto<User>> {
  const user = await this.usersService.createUser(dto);
  return SuccessResponseDto.create(user, 'User created successfully');
  // Response:
  // {
  //   "success": true,
  //   "data": {...user},
  //   "message": "User created successfully",
  //   "timestamp": "2026-02-03T10:00:00.000Z"
  // }
}
```

## Error Handling

Sử dụng `AppException` để throw errors với format chuẩn:

```typescript
import { AppException } from '@common/exceptions/app.exception';
import { ErrorCode } from '@common/enums/errror-code.enum';

throw new AppException(
  ErrorCode.VALIDATION_ERROR,
  'Invalid user data',
  HttpStatus.BAD_REQUEST,
  { field: 'email', issue: 'already exists' }
);

// Response sẽ tự động thành:
// {
//   "success": false,
//   "code": "VALIDATION_ERROR",
//   "message": "Invalid user data",
//   "details": { "field": "email", "issue": "already exists" },
//   "timestamp": "2026-02-03T10:00:00.000Z",
//   "path": "/users"
// }
```

## Error Codes

Các error codes được định nghĩa trong `ErrorCode` enum:

- `VALIDATION_ERROR`: Lỗi validation dữ liệu
- `LEAVE_OVERLAP`: Lỗi xung đột thời gian nghỉ phép
- `CONFLICT_VERSION`: Lỗi xung đột version
- `FORBIDDEN`: Không có quyền truy cập
- `INTERNAL_ERROR`: Lỗi server nội bộ

## Frontend Integration

Ví dụ xử lý response ở frontend (React/JavaScript):

```javascript
// Success case
const response = await api.get('/users');
if (response.success) {
  const users = response.data;
  console.log(users);
}

// Error case
try {
  await api.post('/users', userData);
} catch (error) {
  if (error.response?.data) {
    const { code, message, details } = error.response.data;
    console.error(`Error ${code}: ${message}`, details);
  }
}
```

### TypeScript Types cho Frontend

```typescript
// Copy các types này vào frontend project
export type ApiSuccessResponse<T = any> = {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
  path?: string;
};

export type ApiErrorResponse = {
  success: false;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
};

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;
```

## Lưu ý quan trọng

1. **Tự động wrapping**: Tất cả responses đều được tự động wrap. Không cần phải tự wrap trong controller.

2. **Backwards compatibility**: Nếu controller đã return object có field `success`, system sẽ giữ nguyên format đó.

3. **Void responses**: Các endpoint trả về `void` (như DELETE) sẽ có `data: null`.

4. **File downloads**: Các endpoints trả về files/streams không bị ảnh hưởng bởi interceptor.

5. **Validation errors**: Class-validator errors tự động được format với code `VALIDATION_ERROR`.

## Ví dụ Complete

### Backend Controller

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SuccessResponseDto } from '@common/dto';

@Controller('users')
export class UsersController {
  // Tự động wrapping
  @Get()
  async getAll() {
    return await this.service.findAll();
  }

  // Custom message
  @Post()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.service.create(dto);
    return SuccessResponseDto.create(user, 'User created successfully');
  }

  // Error handling
  @Get(':id')
  async getOne(@Param('id') id: number) {
    const user = await this.service.findOne(id);
    if (!user) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND
      );
    }
    return user;
  }
}
```

### Frontend Service

```typescript
import axios from 'axios';
import { ApiResponse, ApiSuccessResponse } from './types/api-response';

const api = axios.create({
  baseURL: 'http://localhost:3000',
});

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.data?.success === false) {
      const { code, message, details } = error.response.data;
      // Handle error globally
      console.error(`API Error [${code}]: ${message}`, details);
    }
    return Promise.reject(error);
  }
);

export const userService = {
  async getAll(): Promise<User[]> {
    const response: ApiSuccessResponse<User[]> = await api.get('/users');
    return response.data;
  },

  async create(data: CreateUserDto): Promise<User> {
    const response: ApiSuccessResponse<User> = await api.post('/users', data);
    return response.data;
  },
};
```

## Migration từ code cũ

Nếu có code cũ trả về object với `statusCode` và `message`:

**Trước:**
```typescript
return {
  statusCode: HttpStatus.OK,
  message: 'Success',
  data: result
};
```

**Sau:**
```typescript
// Cách 1: Chỉ return data (khuyến nghị)
return result;

// Cách 2: Sử dụng SuccessResponseDto nếu cần message
return SuccessResponseDto.create(result, 'Success');
```

## Hỗ trợ

Nếu có câu hỏi hoặc gặp vấn đề, vui lòng liên hệ team backend.
