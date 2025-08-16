export type StandardResponse<T = unknown> = {
    success: boolean;
    code: string;
    message?: string;
    data?: T;
    requestId?: string;
  };