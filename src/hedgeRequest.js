import Promise from 'bluebird';
import Measured from 'measured';

import { RollingHdrHistogram } from './utils/hdr-histogram';

import type Filter from './index';

type HedgeServiceOptions = {
  percentile: number,
  minMs: number,
  histogram: RollingHdrHistogram,
  debug: boolean
};

export function computeHedgeRequestDelay(
  latencyHistogram: RollingHdrHistogram,
  options: HedgeServiceOptions
): number {
  if (latencyHistogram.hasEnoughData()) {
    const latency = latencyHistogram.percentile(options.percentile);
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

export function computeLatency(promise, timer, histogram) {
  const compute = () => histogram.record(timer.end());
  promise.then(compute, compute);
}

export default function hedgeRequestFilter<T>(
  options: HedgeServiceOptions,
): Filter<T> {
  const { histogram, histogramOptions, minMs, debug } = options;

  return (service) => {
    const latencyHistogram = histogram || new RollingHdrHistogram(histogramOptions || {});
    return (...input) => {
      const timer = new Measured.Stopwatch();

      const mainRequest = service(...input);
      computeLatency(mainRequest, timer, latencyHistogram);

      let result = mainRequest;

      const hedgeDelay = computeHedgeRequestDelay(latencyHistogram, options);
      if (hedgeDelay >= minMs) {
        const hedgeRequest = Promise.delay(hedgeDelay).then(() => service(...input));
        cancelOthersOnFinish(mainRequest, hedgeRequest);

        if (debug) {
          // printHedgeServiceDiff(mainRequest, hedgeRequest, timer);
        }

        result = Promise.any([mainRequest, hedgeRequest]);
      }

      return result;
    };
  };
}

