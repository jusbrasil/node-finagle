// @flow

import Promise from 'bluebird';
import Measured from 'measured';

import { RollingHdrHistogram } from './utils/hdr-histogram';

import type { Filter, Service } from './index';

type Stat<Req> = {
  countHedgeTiedRequestFaster: (req: Req) => void,
  countHedgeOriginalRequestFaster: (req: Req) => void,
  observeHedgeOriginalRequestLatency: (ms: number, req: Req) => void,
  observeHedgeTiedRequestLatency: (ms: number, req: Req) => void,
};

type HedgeServiceOptions<Req> = {
  percentile: number,
  minMs: number,
  histogram?: RollingHdrHistogram,
  histogramOptions?: Object,
  stats?: Stat<Req>,
};

export function computeHedgeRequestDelay(
  latencyHistogram: RollingHdrHistogram,
  options: HedgeServiceOptions<any>
): number {
  if (latencyHistogram.hasEnoughData()) {
    const latency = latencyHistogram.percentile(options.percentile);
    return Math.max(latency, options.minMs);
  }

  return -1;
}

export function computeLatency(
  promise: Promise<any>,
  timer: Measured.Stopwatch,
  histogram: RollingHdrHistogram,
  delay: number = 0
) {
  promise.then(() => {
    const latency = timer.end();
    histogram.record(latency - delay);
  });
}

function registerRequestStat<Req>(
  input: Req,
  mainRequest: Promise<any>,
  hedgeRequest: Promise<any>,
  hedgeDelay: number,
  startTime: number,
  stats: Stat<Req>
) {
  let endedCount = 0;
  const onFinish = (requestKind) => () => {
    endedCount++;

    const latency = Date.now() - startTime;

    if (latency < hedgeDelay) {
      return;
    }

    if (requestKind === 'hedge') {
      stats.observeHedgeTiedRequestLatency(latency, input);
    } else {
      stats.observeHedgeOriginalRequestLatency(latency, input);
    }

    if (endedCount === 1) {
      if (requestKind === 'hedge') {
        stats.countHedgeTiedRequestFaster(input);
      } else {
        stats.countHedgeOriginalRequestFaster(input);
      }
    }
  };

  mainRequest.then(onFinish('main'));
  hedgeRequest.then(onFinish('hedge'));
}

function createHeadgeRequest<Req, Rep>(
  originalPromise: Promise<Rep>,
  delay: number,
  service: Service<Req, Rep>,
  input: Req
): Promise<Rep> {
  let aborted = false;
  const onOriginalFinish = () => { aborted = true; };
  originalPromise.then(onOriginalFinish, onOriginalFinish);

  return new Promise((resolve) => {
    const executeHedgeRequest = () => {
      if (!aborted) resolve(service(input));
    };
    setTimeout(executeHedgeRequest, delay);
  });
}

export default function hedgeRequestFilter<Req, Rep>(
  options: HedgeServiceOptions<Req>,
): Filter<Req, Req, Rep, Rep> {
  const {
    histogram,
    histogramOptions,
    minMs,
    stats,
  } = options;

  return (service: Service<Req, Rep>) => {
    const latencyHistogram = histogram || new RollingHdrHistogram(histogramOptions || {});
    return (input: Req) => {
      const timer = new Measured.Stopwatch();
      const startTime = Date.now();

      const mainRequest = Promise.resolve(service(input));
      computeLatency(mainRequest, timer, latencyHistogram);

      let result = mainRequest;

      const hedgeDelay = computeHedgeRequestDelay(latencyHistogram, options);
      if (hedgeDelay >= minMs) {
        const hedgeRequest = createHeadgeRequest(mainRequest, hedgeDelay, service, input);

        const hedgeTimer = new Measured.Stopwatch();
        computeLatency(hedgeRequest, hedgeTimer, latencyHistogram, hedgeDelay);

        if (stats) {
          registerRequestStat(input, mainRequest, hedgeRequest, hedgeDelay, startTime, stats);
        }

        result = (
          Promise
            .race([mainRequest, hedgeRequest])
            .catch(Promise.AggregateError, () => mainRequest)
        );
      }

      return result;
    };
  };
}

