// @flow

/* eslint-disable no-param-reassign */

import { values } from 'lodash';

import type { Filter, Service } from './index';

type DedupOptions<Req> = {
  hash?: (r: Req) => string,
  join?: (r1: Req, r2: Req) => Req,
};

export default function dedupFilter<Req, Rep>(
  options: DedupOptions<Req> = {},
): Filter<Array<Req>, Array<Req>, Array<Rep>, Array<Rep>> {
  const defaultHash = (r: Req) => JSON.stringify(r);
  const defaultJoin = (r1: Req, r2: Req) => r2;
  const {
    hash = defaultHash,
    join = defaultJoin,
  } = options;

  const dedupInputs = (inputs: Array<Req>) => (
    values(inputs.reduce((acc, req, idx) => {
      const reqHash = hash(req);
      const oldValue = acc[reqHash];
      acc[reqHash] = {
        positions: oldValue ? oldValue.positions.concat([idx]) : [idx],
        input: oldValue ? join(oldValue.input, req) : req,
      };
      return acc;
    }, {}))
  );

  return (service: Service<Array<Req>, Array<Rep>>) => (
    (inputs: Array<Req>) => {
      const inputsInfo = dedupInputs(inputs);
      const uniqueInputs = inputsInfo.map(b => b.input);

      return service(uniqueInputs).then(responses => {
        if (responses.length !== uniqueInputs.length) {
          let info = '';
          try {
            info = JSON.stringify({ uniqueInputs });
          } catch (ex) {
            info = `${uniqueInputs}`
          }
          throw new Error(`Server did not return all requested: ${info}`);
        }

        return responses.reduce((allResults, res, idx) => {
          const item = inputsInfo[idx];

          item.positions.forEach(pos => {
            allResults[pos] = res;
          });

          return allResults;
        }, []);
      });
    }
  );
}

