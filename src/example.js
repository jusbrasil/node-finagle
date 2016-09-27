// @flow


import { FilterStack } from './index';
import hedgeRequest from './hedgeRequest';
import forkJoin from './forkJoin';

const catchArgs = (service) => (...input) => service({ args: input });
const duplicateRequest = (service) => (input) => service([input, input]);

const x = FilterStack
  .prepare()
  .andThen(catchArgs)
  .andThen(duplicateRequest)
  .andThen(forkJoin({
    maxItems: 1,
    fork: (args) => [args, args],
    join: (results) => Promise.all(results),
  }))
  .andThen(hedgeRequest({}));

x.builder((y) => Promise.resolve(y.map(z => z.args)));
