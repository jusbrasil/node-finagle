// @flow

import dedupFilter from '../dedup';

describe('dedup filter', () => {
  it('should dedup requests with default options', async () => {
    const baseService = jest.fn(
      (items) => Promise.resolve(items.map(i => `${i}!`))
    );

    const finalService = dedupFilter({})(baseService);
    const result = await finalService(['1', '2', '3', '1', '2', '3', '1', '1']);

    expect(result).toEqual(['1!', '2!', '3!', '1!', '2!', '3!', '1!', '1!']);
    expect(baseService).toHaveBeenCalledWith(['1', '2', '3']);
  });

  it('should dedup with custom props', async () => {
    const baseService = jest.fn(
      (items) => Promise.resolve(items.map(i => `${i.id}!`))
    );

    const finalService = dedupFilter({
      hash: (r) => r.id,
      join: (r1, r2) => ({ id: r1.id, selections: [...r1.selections, ...r2.selections] }),
    })(baseService);

    const result = await finalService([
      { id: '1', selections: ['a'] },
      { id: '2', selections: ['b'] },
      { id: '3', selections: ['c'] },
      { id: '3', selections: ['a', 'd'] },
      { id: '1', selections: ['c'] },
      { id: '2', selections: ['e'] },
      { id: '4', selections: ['x'] },
    ]);

    expect(result).toEqual(['1!', '2!', '3!', '3!', '1!', '2!', '4!']);
    expect(baseService).toHaveBeenCalledWith([
      { id: '1', selections: ['a', 'c'] },
      { id: '2', selections: ['b', 'e'] },
      { id: '3', selections: ['c', 'a', 'd'] },
      { id: '4', selections: ['x'] },
    ]);
  });
});
