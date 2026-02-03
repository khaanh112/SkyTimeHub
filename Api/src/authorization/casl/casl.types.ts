// Define all actions that can be performed
export enum Action {
  Manage = 'manage', // wildcard for any action
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
  Approve = 'approve',
  Reject = 'reject',
}

// Define all subjects/resources in the system
export type Subjects = 
  | 'User'
  | 'Leave'
  | 'Overtime'
  | 'Attendance'
  | 'Department'
  | 'Report'
  | 'Setting'
  | 'all'; // wildcard for any subject
