// @flow

import CircuitBreaker from 'circuit-breaker-js';

import { FilterStack } from './index';
import hedgeRequest from './hedge-request';
import forkJoin from './fork-join';
import batching from './batching';
import circuitBreaker from './circuit-breaker';
import caching from './caching';

// const catchArgs = (service) => (...input) => service({ args: input });
// const duplicateRequest = (service) => (input) => service([input, input]);

const thriftClientBreaker = new CircuitBreaker();

const x = FilterStack
  .prepare()
  .andThen(caching({}))
  .andThen(circuitBreaker({ breaker: thriftClientBreaker }))
  .andThen(batching({}))
  .andThen(forkJoin({
    maxBuckets: 5,
    maxItems: 20,
    fork: (args) => [args, args],
    join: (results) => Promise.all(results),
  }))
  .andThen(hedgeRequest({ percentile: 90, minMs: 10 }));

x.builder((y) => Promise.resolve(y.map(z => z.args)));
