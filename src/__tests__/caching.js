// @flow

import { difference, pick } from 'lodash';
import cachingFilter from '../caching';

describe('caching filter', () => {
  it('should cache response with default options', async () => {
    const baseService = jest.fn(i => Promise.resolve(`${i}!`));
    const finalService = cachingFilter({})(baseService);
    expect(await finalService('1')).toEqual('1!');
    expect(await finalService('2')).toEqual('2!');
    expect(await finalService('3')).toEqual('3!');

    expect(baseService.mock.calls).toEqual([['1'], ['2'], ['3']]);
    baseService.mockClear();

    expect(await finalService('1')).toEqual('1!');
    expect(await finalService('2')).toEqual('2!');
    expect(baseService).not.toHaveBeenCalled();
  });

  it('should cache with custom props', async () => {
    const baseService = jest.fn();
    baseService.mockReturnValueOnce(Promise.resolve({ id: '1!', a: 1, b: 2 }));
    baseService.mockReturnValueOnce(Promise.resolve({ id: '2!', c: 3 }));
    baseService.mockReturnValueOnce(Promise.resolve({ id: '3!', d: 4 }));
    baseService.mockReturnValueOnce(Promise.resolve({ id: '1!', c: 1, d: 3 }));
    baseService.mockReturnValueOnce(Promise.resolve({ id: '1!', e: 5 }));

    const finalService = cachingFilter({
      requestKey: (r) => r.id,
      diff: (nReq, oReq) => {
        const diffSelections = difference(nReq.selections, oReq.selections);
        return diffSelections.length > 0
          ? { id: nReq.id, selections: diffSelections }
          : null;
      },
      merge: (nCache, oCache) => ({
        request: {
          id: nCache.request.id,
          selections: [...oCache.request.selections, ...nCache.request.selections],
        },
        response: (
          Promise.all(
            [oCache.response, nCache.response]
          ).then(
            ([oRep, nRep]) => ({ ...oRep, ...nRep })
          )
        ),
      }),
      mapResponse: (res, req) => res.then(r => pick(r, ['id', ...req.selections])),
    })(baseService);

    const callService = (id, selections) => finalService({ id, selections });

    expect(await callService('1', ['a', 'b'])).toEqual({ id: '1!', a: 1, b: 2 });
    expect(await callService('2', ['c'])).toEqual({ id: '2!', c: 3 });
    expect(await callService('3', ['d'])).toEqual({ id: '3!', d: 4 });
    expect(await callService('1', ['b', 'c', 'd'])).toEqual({ id: '1!', b: 2, c: 1, d: 3 });
    expect(await callService('1', ['a', 'c', 'e'])).toEqual({ id: '1!', a: 1, c: 1, e: 5 });
    expect(baseService.mock.calls).toEqual([
      [{ id: '1', selections: ['a', 'b'] }],
      [{ id: '2', selections: ['c'] }],
      [{ id: '3', selections: ['d'] }],
      [{ id: '1', selections: ['c', 'd'] }],
      [{ id: '1', selections: ['e'] }],
    ]);
  });
});
