// @flow

import CircuitBreaker from 'circuit-breaker-js';
import makeError from 'make-error';

import type { Filter, Service } from './index';

type CircuitBreakerOptions = {
  breaker: Object,
};

export const CircuitBreakerOpen = makeError('CircuitBreakerOpen');

export default function circuitBreaker<Req, Rep>(
  options: CircuitBreakerOptions
): Filter<Req, Req, Rep, Rep> {
  const breaker = options.breaker || new CircuitBreaker();
  return (service: Service<Req, Rep>) => (input: Req) => (
    new Promise((resolve, reject) => {
      const cmd = (success, failure) => {
        const promise = service(input);
        promise.then(resolve, reject);
        promise.then(success, failure);
      };

      breaker.run(cmd, () => reject(new CircuitBreakerOpen()));
    })
  );
}
