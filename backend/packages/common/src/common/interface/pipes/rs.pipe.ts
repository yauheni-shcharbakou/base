import { map, Observable } from 'rxjs';

export class RxPipe {
  static get toArrayItems() {
    return <T>(source: Observable<T[]>): Observable<{ items: T[] }> => {
      return source.pipe(map((items) => ({ items })));
    };
  }

  static get toMapEntries() {
    return <K extends string | number | symbol, V>(
      source: Observable<Map<K, V>>,
    ): Observable<{ entries: Record<K, V> }> => {
      return source.pipe(
        map((value) => {
          return {
            entries: Array.from(value.entries()).reduce(
              (acc: Record<K, V>, [key, value]) => {
                acc[key] = value;
                return acc;
              },
              {} as Record<K, V>,
            ),
          };
        }),
      );
    };
  }
}
