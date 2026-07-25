import axios, { AxiosResponse } from 'axios';

/**
 * Jest mock signature for axios GET calls used by integration service tests.
 */
export type AxiosGetMock = jest.Mock<Promise<AxiosResponse<unknown>>, [string, unknown?]>;

/**
 * Jest mock signature for axios POST calls used by integration service tests.
 */
export type AxiosPostMock = jest.Mock<
  Promise<AxiosResponse<unknown>>,
  [string, unknown?, unknown?]
>;

type AxiosMockByMethod = {
  get: { get: AxiosGetMock };
  post: { post: AxiosPostMock };
};

/**
 * Returns the mocked axios module narrowed to the requested HTTP method.
 */
export function getAxiosMock<Method extends keyof AxiosMockByMethod>(
  method: Method,
): AxiosMockByMethod[Method] {
  void method;
  return axios as unknown as AxiosMockByMethod[Method];
}

/**
 * Builds the minimal AxiosResponse shape required by service unit tests.
 */
export function axiosResponse<T>(status: number, data: T): AxiosResponse<T> {
  return { status, data } as unknown as AxiosResponse<T>;
}
