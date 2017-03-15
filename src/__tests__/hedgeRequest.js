// @flow

import Promise from 'bluebird';
import hedgeRequestFilter from '../hedge-request';

jest.mock('../utils/hdr-histogram', () => jest.fn());
jest.useRealTimers();

describe('hedgeRequest filter', () => {
  const expectRecordedTime = (call, expectedTime, threshold = 10) => {
    expect(call[0] - expectedTime).toBeLessThanOrEqual(threshold);
  };

  const histogram: any = {
    hasEnoughData: () => true,
    percentile: jest.fn(() => 250),
    record: jest.fn(),
  };

  it('should throw original error in case of both fail', async () => {
    const baseService = jest.fn();
    const finalService = hedgeRequestFilter({
      histogram,
      percentile: 90,
      minMs: 10,
    })(baseService);

    const firstError = Error('error-1');
    const secondError = Error('error-2');
    baseService.mockImplementationOnce(() => Promise.reject(firstError));
    baseService.mockImplementationOnce(() => Promise.reject(secondError));

    try { await finalService('r1'); } catch (ex) {
      expect(ex).toEqual(firstError);
    }
  });

  it('should fail imediatelly in case of failure', async () => {
    const baseService = jest.fn();
    const finalService = hedgeRequestFilter({
      histogram,
      percentile: 90,
      minMs: 10,
    })(baseService);

    const firstError = Error('error-1');
    baseService.mockImplementationOnce(() => Promise.reject(firstError));
    baseService.mockImplementationOnce((i) => Promise.resolve(`${i}!`));

    try { await finalService('r1'); } catch (ex) {
      expect(ex).toEqual(firstError);
    }
  });

  it('should hedgeRequest requests with default options', async () => {
    const baseService = jest.fn();
    const finalService = hedgeRequestFilter({
      histogram,
      percentile: 90,
      minMs: 10,
    })(baseService);

    baseService.mockImplementationOnce(() => Promise.delay(100).then(() => '1!'));

    expect(await finalService('r1')).toEqual('1!');
    expect(baseService.mock.calls).toEqual([['r1']]);
    expectRecordedTime(histogram.record.mock.calls[0], 100);

    // second call
    baseService.mockImplementationOnce(() => Promise.delay(300).then(() => '2!'));
    baseService.mockImplementationOnce(() => Promise.delay(100).then(() => '3!'));

    expect(await finalService('r2')).toEqual('2!');
    expect(baseService.mock.calls).toEqual([['r1'], ['r2'], ['r2']]);
    expectRecordedTime(histogram.record.mock.calls[1], 300);

    // third call
    baseService.mockImplementationOnce(() => Promise.delay(500).then(() => '4!'));
    baseService.mockImplementationOnce(() => Promise.delay(100).then(() => '5!'));

    expect(await finalService('r3')).toEqual('5!');
    expect(baseService.mock.calls).toEqual([['r1'], ['r2'], ['r2'], ['r3'], ['r3']]);
    expectRecordedTime(histogram.record.mock.calls[2], 350);
  });
});
