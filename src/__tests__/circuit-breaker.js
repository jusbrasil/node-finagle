// @flow

import CircuitBreaker from 'circuit-breaker-js';
import circuitBreakerFilter, { CircuitBreakerOpen } from '../circuit-breaker';

describe('circuit breaker filter', () => {
  const error = Error('error');
  const ignoreError = Error('ignore-error');

  it('should circuit breaker requests with default options', async () => {
    const baseService = jest.fn(i => Promise.resolve(`${i}!`));
    const finalService = circuitBreakerFilter({})(baseService);
    expect(await finalService('1')).toEqual('1!');
    expect(await finalService('2')).toEqual('2!');
    expect(await finalService('3')).toEqual('3!');
    expect(baseService.mock.calls).toEqual([['1'], ['2'], ['3']]);
  });

  it('should update circuit breaker with result', async () => {
    const success = jest.fn();
    const failure = jest.fn();
    const breaker = { run: (cmd) => cmd(success, failure) };

    const baseService = jest.fn(i => Promise.resolve(`${i}!`));
    const finalService = circuitBreakerFilter({ breaker })(baseService);

    expect(await finalService('1')).toEqual('1!');
    expect(await finalService('2')).toEqual('2!');

    baseService.mockImplementation(() => Promise.reject(error));
    try { await finalService('3'); } catch (ex) {
      expect(ex).toEqual(error);
    }

    expect(success).toHaveBeenCalledTimes(2);
    expect(failure).toHaveBeenCalledTimes(1);
  });

  it('should respesct isFailure function when available', async () => {
    const success = jest.fn();
    const failure = jest.fn();
    const breaker = { run: (cmd) => cmd(success, failure) };

    const isFailure = jest.fn(ex => !ex.message.includes('ignore-error'));
    const baseService = jest.fn(i => Promise.resolve(`${i}!`));
    const finalService = circuitBreakerFilter({ breaker, isFailure })(baseService);

    expect(await finalService('1')).toEqual('1!');

    baseService.mockImplementationOnce(() => Promise.reject(error));
    try { await finalService('2'); } catch (ex) {
      expect(ex).toEqual(error);
    }

    baseService.mockImplementationOnce(() => Promise.reject(ignoreError));
    try { await finalService('3'); } catch (ex) {
      expect(ex).toEqual(ignoreError);
    }

    baseService.mockImplementationOnce(() => Promise.reject(error));
    try { await finalService('4'); } catch (ex) {
      expect(ex).toEqual(error);
    }

    expect(success).toHaveBeenCalledTimes(2);
    expect(isFailure).toHaveBeenCalledTimes(3);
    expect(failure).toHaveBeenCalledTimes(2);
  });


  it('should respect provided circuit breaker', async () => {
    const breaker = new CircuitBreaker();
    const baseService = jest.fn(i => Promise.resolve(`${i}!`));
    const finalService = circuitBreakerFilter({ breaker })(baseService);

    expect(await finalService('1')).toEqual('1!');
    breaker.forceOpen();

    try { await finalService('2'); } catch (ex) {
      expect(ex).toBeInstanceOf(CircuitBreakerOpen);
    }

    try { await finalService('3'); } catch (ex) {
      expect(ex).toBeInstanceOf(CircuitBreakerOpen);
    }

    breaker.forceClose();
    expect(await finalService('4')).toEqual('4!');

    expect(baseService.mock.calls).toEqual([['1'], ['4']]);
  });
});
