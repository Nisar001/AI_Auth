import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../src/middlewares/auth';

export const mockRequest = (
  body: any = {},
  user: any = undefined,
  params: any = {},
  query: any = {},
  ip: string = '127.0.0.1'
): AuthenticatedRequest => {
  return {
    body,
    params,
    query,
    headers: {},
    user,
    cookies: {},
    ip,
    get: jest.fn().mockImplementation(name => {
      if (name === 'User-Agent') return 'Test-User-Agent';
      return '';
    })
  } as unknown as AuthenticatedRequest;
};

export const mockResponse = (): Response => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as Response;
};

export const mockNext = jest.fn() as NextFunction;
