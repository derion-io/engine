export type Primitive = string | number | boolean | symbol | undefined | null;
export type Builtin = Primitive | Function | Date | Error | RegExp;
export type IsTuple<T> = T extends any[] ? (any[] extends T ? never : T) : never;
export type IsAny<T> = 0 extends 1 & T ? true : false;
export type IsUnknown<T> = IsAny<T> extends true ? false : unknown extends T ? true : false;
/** Like Partial but recursive */
export type DeepPartial<T> = T extends Builtin ? T : T extends Map<infer K, infer V> ? Map<DeepPartial<K>, DeepPartial<V>> : T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<DeepPartial<K>, DeepPartial<V>> : T extends WeakMap<infer K, infer V> ? WeakMap<DeepPartial<K>, DeepPartial<V>> : T extends Set<infer U> ? Set<DeepPartial<U>> : T extends ReadonlySet<infer U> ? ReadonlySet<DeepPartial<U>> : T extends WeakSet<infer U> ? WeakSet<DeepPartial<U>> : T extends Array<infer U> ? T extends IsTuple<T> ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Array<DeepPartial<U> | undefined> : T extends Promise<infer U> ? Promise<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : IsUnknown<T> extends true ? unknown : Partial<T>;
