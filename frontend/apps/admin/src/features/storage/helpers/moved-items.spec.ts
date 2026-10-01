import { getRenamedItems } from './moved-items';

describe('getRenamedItems', () => {
  it('lists the items that came back under another name', () => {
    expect(
      getRenamedItems(
        [
          { id: '1', name: 'a.txt' },
          { id: '2', name: 'docs' },
        ],
        [
          { id: '1', name: 'a (1).txt' },
          { id: '2', name: 'docs' },
        ],
      ),
    ).toEqual([{ from: 'a.txt', to: 'a (1).txt' }]);
  });
});
