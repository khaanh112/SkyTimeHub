export type ApiError = {
  code: string;          
  message: string;       
  details?: unknown;    
  timestamp: string;
  path: string;
};
