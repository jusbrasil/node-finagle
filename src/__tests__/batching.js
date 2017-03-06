// @flow

import batchingFilter from '../batching';

describe('batching filter', () => {
  it('should batch requests', async () => {
    const baseService = jest.fn(
      (items) => Promise.resolve(items.map(i => `${i}!`))
    );

    const finalService = batchingFilter({})(baseService);
    const requests = [
      finalService('1'),
      finalService('2'),
      finalService('3'),
      finalService('1'),
      finalService('3'),
    ];
    expect(await Promise.all(requests)).toEqual(['1!', '2!', '3!', '1!', '3!']);
    expect(baseService).toHaveBeenCalledTimes(1);
    expect(baseService).toHaveBeenCalledWith(['1', '2', '3', '1', '3']);
  });
});
