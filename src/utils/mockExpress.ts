import { Request, Response, NextFunction } from 'express';

export const mockRequest = (overrides: Record<string, any> = {}): Request => {
  const req: Partial<Request> = {
    body: {},
    query: {},
    params: {},
    headers: {},
    ...overrides
  };
  // Allow custom user property for tests
  if (overrides.user !== undefined) {
    (req as any).user = overrides.user;
  }
  return req as Request;
};

export const mockResponse = (): Response => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  return res as Response;
};

export const mockNext: NextFunction = jest.fn();
