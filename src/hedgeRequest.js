import Promise from 'bluebird';
import { History, Stopwatch } from 'measured';

import type Filter from './index';

type HedgeServiceOptions = {
  percentile: number,
  minMs: number,
  history: History,
  debug: boolean
};

export function computeHedgeRequestDelay(
  latencyHistory: History,
  options: HedgeServiceOptions
): number {
  const { _count: count } = latencyHistory;

  if (count > 10) {
    const [latency] = latencyHistory.percentiles([options.percentile]);
    return Math.max(latency, options.minMs);
  }

  return -1;
}

export function cancelOthersOnFinish(main: Promise<any>, tied: Promise<any>): boolean {
  let finished = false;
  const cancel = (p) => {
    if (!finished) {
      p.cancel();
      finished = true;
    }
  };
  main.then(() => cancel(tied));
  tied.then(() => cancel(main));
}

export function computeLatency(promise, timer, history) {
  const compute = () => history.update(timer());
  promise.then(compute, compute);
}

export default function hedgeRequestFilter<T>(
  options: HedgeServiceOptions,
): Filter<T> {
  return (service) => {
    const latencyHistory = options.history || new History();
    return (...input) => {
      const timer = new Stopwatch();

      const mainRequest = service(...input);
      computeLatency(mainRequest, timer, latencyHistory);

      let result = mainRequest;

      const hedgeDelay = computeHedgeRequestDelay(latencyHistory, options);
      if (hedgeDelay >= options.minMs) {
        const hedgeRequest = Promise.delay(hedgeDelay, () => service(...input));
        cancelOthersOnFinish(mainRequest, hedgeRequest);

        if (options.debug) {
          // printHedgeServiceDiff(mainRequest, hedgeRequest, timer);
        }

        result = Promise.any(mainRequest, hedgeRequest);
      }


      return result;
    };
  };
}

