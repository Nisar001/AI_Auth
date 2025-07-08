export class ApiResponse {
  public success: boolean;
  public statusCode: number;
  public message: string;
  public data?: any;
  public errors?: any[];

  constructor(
    statusCode: number,
    message: string,
    data?: any,
    success?: boolean
  ) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.success = success ?? statusCode < 400;
  }

  static success(data: any, message: string = 'Success', statusCode: number = 200) {
    return new ApiResponse(statusCode, message, data, true);
  }

  static error(message: string, statusCode: number = 500, errors?: any[]) {
    const response = new ApiResponse(statusCode, message, null, false);
    if (errors) {
      response.errors = errors;
    }
    return response;
  }
}
