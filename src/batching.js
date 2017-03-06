// @flow

import DataLoader from 'dataloader';

import type { Filter, Service } from './index';

type BatchingOptions<Req> = {
  stats?: {
    observeBatchSize: (size: number, req: Array<Req>) => void,
  },
};


export default function batchingFilter<Req, Rep>(
  options: BatchingOptions<Req>
): Filter<Req, Array<Req>, Array<Rep>, Rep> {
  const { stats } = options;

  return (service: Service<Array<Req>, Array<Rep>>) => {
    const dataloader = new DataLoader((inputs) => {
      if (stats) stats.observeBatchSize(inputs.length, inputs);
      return service(inputs);
    }, { cache: false });

    return (input: Req) => dataloader.load(input);
  };
}
