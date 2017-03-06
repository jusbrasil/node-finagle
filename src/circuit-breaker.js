// @flow

import CircuitBreaker from 'circuit-breaker-js';
import makeError from 'make-error';

import type { Filter, Service } from './index';

type CircuitBreakerOptions<Req> = {
  breaker?: Object,
  stats?: {
    countCircuitOpen: (req: Req) => void,
    countCircuitClose: (req: Req) => void,
  },
};

export const CircuitBreakerOpen = makeError('CircuitBreakerOpen');

export default function circuitBreakerFilter<Req, Rep>(
  options: CircuitBreakerOptions<Req>,
): Filter<Req, Req, Rep, Rep> {
  const {
    breaker = new CircuitBreaker(options),
    stats,
  } = options;

  return (service: Service<Req, Rep>) => (input: Req) => (
    new Promise((resolve, reject) => {
      const cmd = (success, failure) => {
        const promise = service(input);
        promise.then(resolve, reject);
        promise.then(success, failure);
        if (stats) stats.countCircuitClose(input);
      };

      breaker.run(cmd, () => {
        reject(new CircuitBreakerOpen());
        if (stats) stats.countCircuitOpen(input);
      });
    })
  );
}
