import { uniqueID } from 'web-utility';

const uniqueKey = uniqueID();

export class ProxyMap<K extends WeakKey, V> implements WeakMap<K, V> {
  [Symbol.toStringTag] = 'ProxyMap';

  set(key: K, value: V) {
    (key as Record<string, any>)[uniqueKey] = value;

    return this;
  }

  get(key: K): V | undefined {
    return (key as Record<string, any>)[uniqueKey];
  }

  has(key: K) {
    return uniqueKey in key;
  }

  delete(key: K) {
    return delete (key as Record<string, any>)[uniqueKey];
  }
}
