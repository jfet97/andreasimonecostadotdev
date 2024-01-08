+++
author = "Andrea Simone Costa"
title = "How to express correlations"
date = "2024-01-08"
description = "Expressing correlations has never been so difficult"
categories = ["typescript"]
series = ["TypeScript"]
published = false
tags = [
    "correlations",
]
featuredImage = "/images/esprimere_correlazioni/copertina.png"
images = ["/images/esprimere_correlazioni/copertina.png"]
+++

## Introduction

In this article, I delve into the details of a semi-obscure and sufficiently complex yet quite powerful pattern for expressing correlations between different entities or within the same entity. Over time, I've found it recommended multiple times to solve seemingly unrelated problems that, in reality, share a common root. The featured pattern is well presented in [this pull request](https://github.com/microsoft/TypeScript/pull/47109), although it has been available for quite some time. Furthermore, the pattern has been moderately enhanced since the `4.6` version of the language.

I have a love-hate relationship with this pattern. The love stems from its ability to express correlations that would otherwise require risky type assertions, explicit or implicit. The hate is based on the fact that one is compelled to define the types involved in a rather unusual, I dare say non-idiomatic, and especially not easy-to-read manner.

We'll examine an instance of the problem it solves and how to exploit it in a masterful way in the specific case. Regardless of my opinion, it remains an invaluable tool to include in your toolbox, and sometimes the only one to tackle certain situations. I will then explain what I dislike and propose a solution to mitigate these difficulties.

&nbsp;

## The problem

```ts
type NumberRecord = { kind: "n", v: number, f: (v: number) => void };
type StringRecord = { kind: "s", v: string, f: (v: string) => void };
type BooleanRecord = { kind: "b", v: boolean, f: (v: boolean) => void };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

function processRecord(record: UnionRecord) {
    record.f(record.v); // error!
    // Argument of type 'string | number | boolean' is not assignable to parameter of type 'never'
}
```

By design, the code above is certainly correct, but TypeScript is unable to see the correlation between `record.v` and `record.f`. The meaning of the error is quickly explained: TypeScript knows that `record.f` is a function, but it cannot determine which of the three functions it is. Therefore, for safety, TypeScript requires that the parameter be acceptable in every case. It must be both a `number` and a `string` and a `boolean`, but there are no values that satisfy this requirement! The intersection of `number`, `string`, and `boolean` is precisely the `never` type, which has no inhabitants.

&nbsp;

## The pattern

As a first step, let's slightly modify the starting point of the problem by changing the definition of the `UnionRecord` type as follows:

```ts
type UnionRecord = 
    | { kind: "n", v: number, f: (v: number) => void }
    | { kind: "s", v: string, f: (v: string) => void }
    | { kind: "b", v: boolean, f: (v: boolean) => void };
```

We have just removed the intermediate types `NumberRecord` ,`StringRecord` and `BooleanRecord`. The `UnionRecord` type is a discriminated union: the discriminant is the `kind` field, which is a string literal type.

The values of the `kind` property can be used as keys for an object type, and it is on this simple observation that the entire pattern pivots. We must indeed define a __type map__ that will serve as the backbone of the entire correlation:

```ts
type TypeMap = {
    n: number,
    s: string,
    b: boolean
};
```

The type map associates the aforementioned `kind` with the corresponding type of the `v` field, which is also the type of the parameter for the `f` function in the same union entry. We will see later that we have some freedom in defining the type map that underpins the entire correlation; however, in this case, this precise definition is the most natural one.

Let's now introduce the `RecordType` type function:

```ts
type RecordType<K extends keyof TypeMap> = { 
    kind: K,
    v: TypeMap[K], 
    f: (v: TypeMap[K]) => void 
};
```

The type function `RecordType<K>` perfectly encodes the correspondence between the `kind`, the types, and the two related properties. It is defined in terms of `TypeMap`, which serves as an upper bound for the type parameter `K` and is used to correlate the `v` field with the parameter of the `f` function: they both have the type `TypeMap[K]`.

`RecordType` is nothing more than the skeleton of the union `UnionRecord` defined in the previous snippet, a union that now we can express in the following way:

```ts
type UnionRecord = RecordType<'n'> | RecordType<'s'> | RecordType<'b'>;
```

Let's take another shot at defining `processRecord`, this time utilizing `TypeMap` and `RecordType`:

```ts
function processRecord<K extends keyof TypeMap>(record: RecordType<K>) {
    record.f(record.v);
}
```

It's worth noting that the parameter type isn't `UnionRecord`, nor is it a type parameter with an upper bound of `UnionRecord`. Instead, it's a `RecordType<K>`, where `K` is a type parameter with an upper bound of `TypeMap`. Within the function, the type of `record.f` is `(v: TypeMap[K]) => void`, while the type of `record.v` is `TypeMap[K]`. Everything is good and dandy.

By defining everyting in terms of the `TypeMap` type, TypeScript is finally able to see the correlation.

[Link to the playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.3.3#code/C4TwDgpgBAKuEFkCGYoF4oG8oDsBcuArgLYBGEATgDRQDOBtwFAljgOY2kGkD2PANhCQ4oAXwDcAKEmhIUAEoQAxjwoATOJAA8AaSgQAHsAg41tKAGsIIHgDNY8ZGAB86LFElRLrNQR01PKAA3Ak1EFABtHQBdAK9bAgAKEIdIJyjogEp0VyCeZjUPCWlZaABVHGYeHEUVdTda1Q14LQByHFbXAB8FZSawttpOqB7G9QHW0k6pSVtCHCVgKpEwCh4lCFpaMbVdfSMTM0trO1Twl0SKPvUCHYGdZ2zMQK8rurUAOltL68+gzPEXgA9ECoAB5CySUSSIA).

### Code obfuscation

It is then officially recommended to merge together `RecordType` and `UnionRecord` to avoid the possibility of creating non-distributed records (e.g., `RecordType<"n" | "b">`) and to automate the definition of `UnionRecord` itself based on the entries of `TypeMap`:

```ts
type TypeMap = {
    n: number,
    s: string,
    b: boolean
};

type UnionRecord<K extends keyof TypeMap = keyof TypeMap> = {
    [P in K]: {
        kind: P,
        v: TypeMap[P],
        f: (v: TypeMap[P]) => void
    }
}[K];

function processRecord<K extends keyof TypeMap>(record: UnionRecord<K>) {
    record.f(record.v);
}
```

In short, what used to be `RecordType` is now directly distributed over a subset `K` of keys in `TypeMap`. The default value of the type parameter is not strictly necessary, but it comes in handy when we require the entire union.

### Partial code deobfuscation

The following snippet shows that the correlation is maintained even when indexing a non-parametric mapped type, but defined in terms of the type map with an appropriate parametric index type:

```ts
type TypeMap = {
    n: number,
    s: string,
    b: boolean
};

type UnionRecordMap = {
    [P in keyof TypeMap]: {
        kind: P,
        v: TypeMap[P],
        f: (v: TypeMap[P]) => void
    }
};

type UnionRecord = UnionRecordMap[keyof TypeMap];

function processRecord<K extends keyof TypeMap>(record: UnionRecordMap[K]) {
    record.f(record.v);
}
```

The keys of the mapped type `UnionRecordMap` are indeed the keys of the type map, and the indexing `UnionRecordMap[K]` occurs with a parametric index type `K` whose upper bound is `keyof TypeMap` as before.

However, there is a significant difference compared to the previous cases: with this solution, TypeScript is unable to infer the actual types of `K` during the invocation of `processRecord`. It will always be `keyof TypeMap`, as shown in [this playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.3.3&ssl=17&ssc=49&pln=17&pc=55#code/C4TwDgpgBAKuEFkCGYoF4oG8BQU9QDsAuQgVwFsAjCAJwBpd8BnEp4GgSwIHMH8pKJSgHthAGwhIC2AL4BubNlCQoAVQIdhBAEoQAxsJoATZKgw5+AbQAKULlADWEEMIBmseKYC6JC-3wOXEYk1nz+eABuJHCQpjZeYeGuJAAUUR6xKPEAlOgAfFARwhxGjHgysgpK8GoaWroGxui1mjr6hiZZTi7uMYgoXlWupAR6wK1QYDTCehBMTA0dADwA0lAQAB7AEARGTI7Obhn9YHkpNO3GJOqti8ZxK165fngXjUYAdK7nl58R2QoKtgpjM5gtfilMI4giQAEQEWF0QokACMAAYkckoGkSAQKNQaLk0AUDAQmOIIB8xMJuGkoAAqKDo7IybLYAD07KgAD0APxAA). Both of the previous solutions do not suffer from this issue.

### Extracting the functions

To showcase the power of this pattern, let's pull out the functions `f` into another structure. You'll see that we can still correlate all of this thanks to our type map:

```ts
type TypeMap = {
    n: number,
    s: string,
    b: boolean
};

type ValueRecord<K extends keyof TypeMap = keyof TypeMap> = { 
    [P in K]: {
        kind: P,
        v: TypeMap[P]
    }
}[K];

type FuncRecord = { 
    [P in keyof TypeMap]: (x: TypeMap[P]) => void
};

function processRecord<K extends keyof TypeMap>(
    recv: ValueRecord<K>,
    recfs: FuncRecord
) {
    return recfs[recv.kind](recv.v);
}
```

We have both `ValueRecord` and `FuncRecord` defined in terms of the type map. `ValueRecord` is based on the "verbose" version, allowing the type parameter `K` to be precisely inferred during the invocation of `processRecord`. On the other hand, the definition of `FuncRecord` can be kept as simple as possible: a non-parametric mapped type whose keys are the same as the type map.

Inside `processRecord`, the kind of `recv` is used to index the corresponding function within the `FuncRecord` structure, and that function is then invoked on the value `v` of `recv`. [TypeScript doesn't break a sweat](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.3.3#code/C4TwDgpgBAKuEFkCGYoF4oG8BQU9QDsAuQgVwFsAjCAJwBpd8BnEp4GgSwIHMH8pKJSgHthAGwhIC2AL4BubNlCQoANSRjSEAEoQAxsJoATADwBpKBAAewCASNMoAawghhAM1jxkqDC7eecJA+AHzoWFCMeADaAApQXFBmALokOPz8TlxGJLF8GXgAbiRBiChxyVFQMrLRKQpK8FAAYqQEeroGxuGYkfxxCQTOrh5ewSipUAAUViXe5bHJAJToYYXCHEayDe5tesAcwkNgNMJ6EExMnYamFta29o7+o6WhU1U0+sVqGlrXxuYQvk8J89O4WC09v8tit0vhPsBSDQhqDwdFQYUAHRZezJKYYzGFJYKGrYE5nC5XfQ3d4AelpUAAegB+Kpwgo4nJQABEBG5wIy3wAjAAGKoyAW9Kr8YjTImrKAGAhMcQQTFiYTcKaFKAAKigoqWdD6BSgEO1KzQYSVKok6s12sxn0gSGAUwATEsjSaCoI5ZbrUdbWqNVrlBBRjq0NGeSJVVJuUtxdgk0A).

&nbsp;

## Another problem

Let's go back to the initial definition of records, which now only contain data. Suppose we now want to invoke a specific function on each value `v`. Each function might have its own return value, potentially different from the others. The goal is to define a matching function that, given a `UnionRecord`, calls the corresponding function on its `v` property and returns the returned value with the correct type.

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => b ? 1 : 0;

function match(record: UnionRecord): ?? {
    // ??
}
```

### Attempt #1: overloads

One initial solution to the problem involves combining a `switch` statement with the necessary overloads for the `match` function. The issue with this approach, whether or not the return type is specified in the implementation, is the presence of implicit type assertions: there's no guarantee that the implementation adheres to the indications of the signatures for the various overloads. [Seeing is believing](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.3.3#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuAFChIUAMrBUtAOaZcBYmUq0GzAM7sujLbIVCxE6ACEcOADYQAhjSV5CJctTqMmSXdyhJLN+2NxcGgAVRoqHAdsJ1V4ZDRHFQAfaUMaRRiUqAtrO2jlfDFRXBoDKHwcOCQbVQAKGh4+NABKYgA+KBooACooACYxUvLDBHqtfXT5NqJOrQA6UbqWoaiRnHj6pEY-PPsZzqQoAH4oAEYoRgAGYShRUQAzOBosYEjuhFtgLAALOtQspp4vwkvgWk0EqhHs9Xu8oJ9vn8AYVGDI5BlQeCoAZ0fJoS83lF4V9fv9AYxcgECk4sbxIfjYUSEaTkU5GOF3pjJrioKk6fwyKIoMKoADgHBUN0mFgqLYcExRIIgA).

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => b ? 1 : 0; 

function match(record: NumberRecord): number
function match(record: StringRecord): string
function match(record: BooleanRecord): number
function match(record: UnionRecord): string | number {
    switch(record.kind) {
        case 'n': return double(record.v)
        case 's': return trim(record.v)
        case 'b': return toNum(record.v)
    }
}
```

### Attempt #2: messing with the return type

The solution, I would say, speaks for itself. What's worse is that it stands only thanks to explicit type assertions, with all the risks that come with them. Type assertions are necessary because TypeScript doesn't yet support control flow analysis to refine a parametric type: the type of the `record` is refined within the cases of the `switch`, but the same doesn't happen to the type parameter `R`:

```ts
type NumberRecord = { kind: "n"; v: number };
type StringRecord = { kind: "s"; v: string };
type BooleanRecord = { kind: "b"; v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => (b ? 1 : 0);

type MatchRet<R extends UnionRecord> = R["kind"] extends "n"
  ? number
  : R["kind"] extends "s"
  ? string
  : R["kind"] extends "b"
  ? number
  : never;

function match<R extends UnionRecord>(record: R): MatchRet<R> {
  switch (record.kind) {
    case "n":
      return double(record.v) as MatchRet<R>;
    case "s":
      return trim(record.v) as MatchRet<R>;
    case "b":
      return toNum(record.v) as MatchRet<R>;
  }
}
```

### Attempt #3: another type map as return type

Sometimes, preferring objects over the `switch` construct helps resolve the situation, but not this time:

```ts
type NumberRecord = { kind: "n"; v: number };
type StringRecord = { kind: "s"; v: string };
type BooleanRecord = { kind: "b"; v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => (b ? 1 : 0);

function match<
    R extends UnionRecord
>(record: R): { n: number, s: string, b: number }[R["kind"]] {
    return {
        n: double(record.v), // 'string | number | boolean' not assignable to 'number'
        s: trim(record.v), // 'string | number | boolean' not assignable to 'string'
        b: toNum(record.v) // 'string | number | boolean' not assignable to 'boolean'
    }[record.kind];
           // ^? "n" | "s" | "b" instead of something like R["kind"]
}
```

Firstly, the construction of the indexed object occurs before indexing. This construction is, in fact, impossible since we only have one record available, and its `v` is certainly not usable as a parameter for all three functions. Moreover, to properly align the return parameter a more precise inference of the `kind` field would be necessary, whose type is instead immediately expanded to the upper bound `"n" | "s" | "b"`.

The best compromise I know of is the following, where I use a couple of tricks to solve these problems. Unfortunately, though, we don't have any refinement on `record.v`, so we have to resort once again to type assertions:

```ts
type NumberRecord = { kind: "n"; v: number };
type StringRecord = { kind: "s"; v: string };
type BooleanRecord = { kind: "b"; v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => (b ? 1 : 0);

function match<
    R extends Extract<UnionRecord, { kind: K }>,
    K extends UnionRecord["kind"] = R["kind"]
>(record: R): { n: number; s: string; b: number }[K] {
    return {
        get n() {
            return double(record.v as number);
        },
        get s() {
            return trim(record.v as string);
        },
        get b() {
            return toNum(record.v as boolean);
        },
    }[record.kind];
}
```

### Final attempt: the pattern

It's necessary to resort once again to the pattern discussed in this article. The solution is nothing more than an extension of the [extracting functions case](#extracting-the-functions), where now each function has its own return type:

```ts
type TypeMap = {
    n: number,
    s: string,
    b: boolean
};

type ValueRecord<K extends keyof TypeMap = keyof TypeMap> = {
    [P in K]: {
        kind: P;
        v: TypeMap[P];
    };
}[K];

const recfs = {
    n: (n: number) => n * 2,
    s: (s: string) => s.trim(),
    b: (b: boolean): number => (b ? 1 : 0)
}

type OutputMap = {
    [K in keyof TypeMap]: ReturnType<(typeof recfs)[K]>
};

type FuncRecord = {
    [P in keyof TypeMap]: (v: TypeMap[P]) => OutputMap[P];
};

function match<K extends keyof TypeMap>(
    recv: ValueRecord<K>,
    recfs: FuncRecord
): OutputMap[K] {
    return recfs[recv.kind](recv.v);
}
```

`ValueRecord` is defined in the same wordy way as before, while `OutputMap` and `FuncRecord` are nothing more than mapped types based on the keys of the type map `TypeMap`. In `FuncRecord`, the type of each parameter must necessarily be the type of the corresponding `v` field; otherwise, we couldn't invoke such functions. The return type is arbitrarily determined by the functions in `recfs`. Inside the match function, the kind of `recv` is again used to index the corresponding function within `recfs`, and this function is then invoked on the `v` value of recv. The type returned by match is expressed in terms of `OutputMap`.

[Link to the playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.3.3#code/C4TwDgpgBAKuEFkCGYoF4oG8BQU9QDsAuQgVwFsAjCAJwBpd8BnEp4GgSwIHMH8pKJSgHthAGwhIC2AL4BubNlCQoANSRjSEAEoQAxsJoATADwBpKBAAewCASNMoAawghhAM1jxkqDC7eecJA+AHzoWIwA2gAKUFxQZgC6JDj8TlxGJNEK-ABuJEGIKDGJOVDyspFJCtgGBGxQNPrujhip+MRQABSdBBTUNACU6GEEUABUUABMfMwkXSxQbJw8w2hhTAB07BzkXYOzeILdxyLikgSDJH1UtCMnUAD8UACMUCQADIOyisrQAPKkYBgIE+cLtKpxMb+DxeYIoZJQXTAUg0AiFExdP6wpp6FqDKqJEKyGp-KAAMVIBD0ugMxnBUVi8RhgW8CPm+ThRTAJTWYUBwNBxWipRJincVL0wA4wjG5CQwD0AAtzJYbHYHM5XLDCqEuoxcZz1JodPpDKYzCFZriWiRKdTaebsFcoAKQcAfISIngmii0Y1mkxIobNul7IkuiHcoMFDJFPLFUquphnBkSAAiAjpuhQTkAFim5RzNqY3wA9GWoAA9R7YBPK5Op+wZpjZ3MZvQcJDCdNFgN40vYCvV2v1pMpsOZKDpyhtznuDRMaAyYuB8uVmtAA).

&nbsp;

## What on earth...

Plase, let's take a moment to chew on how much we've messed up the simplicity and neatness of our code to get this pattern in place:

```ts
// from this:
type NumberRecord = { kind: "n"; v: number };
type StringRecord = { kind: "s"; v: string };
type BooleanRecord = { kind: "b"; v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const double = (n: number) => n * 2;
const trim = (s: string) => s.trim();
const toNum = (b: boolean) => (b ? 1 : 0);


// to this:
type TypeMap = {
    n: number,
    s: string,
    b: boolean
};

type ValueRecord<K extends keyof TypeMap = keyof TypeMap> = {
    [P in K]: {
        kind: P;
        v: TypeMap[P];
    };
}[K];

const recfs = {
    n: (n: number) => n * 2,
    s: (s: string) => s.trim(),
    b: (b: boolean): number => (b ? 1 : 0)
}

type OutputMap = {
    [K in keyof TypeMap]: ReturnType<(typeof recfs)[K]>
};

type FuncRecord = {
    [P in keyof TypeMap]: (v: TypeMap[P]) => OutputMap[P];
};
```

What are we talking about? It's mind-boggling. Mind-boggling. It is usually more idiomatic to first define the components of a (discriminated) union and then create the union using the `|` operator, rather than encapsulating everything in a complex type function, as done with `ValueRecord`. It's worth noting that it's not always feasible to straightforwardly apply this latter approach, which can be quite awkward in certain cases. Sometimes, we're just forced to overuse the type map, and believe me, things quickly go south.

### An alternative

I'll be upfront, don't expect the ultimate revelation. I'm going to present a strategy to possibly mitigate the situation, that still doesn't improve all that much. In fact, perhaps it even gets worse. My efforts have focused on keeping the definitions of `UnionRecord` components separate, as is idiomatic. The rest remains almost unchanged: I wasn't able to get rid of either the type map or the remaining definitions built around it.

So, let's start by defining the types of the records:

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;
```

The type map iterates over `UnionRecord` and associates each kind with the corresponding record:
  
```ts
// { n: NumberRecord; s: StringRecord; b: BooleanRecord; }
type TypeMap = {
    [K in UnionRecord["kind"]]: Extract<UnionRecord, { kind: K }>;
};
```

The definition of `ValueRecord` gets a bit complicated. We are forced to manually define the types of the `kind` and `v` fields, always based on the type map, because these two fields are the ones directly accessed by the match function. The type `{ kind: P, v: TypeMap[P]["v"] } & Omit<TypeMap[P], "kind" | "v">` is conceptually identical to `TypeMap[P]`, but TypeScript gets lost within `match` if we use the latter. Note that in this specific example, the intersection with `Omit<TypeMap[P], "kind" | "v">` could be omitted since records don't have any other properties besides `kind` and `v`.

``` ts
type ValueRecord<K extends keyof TypeMap = keyof TypeMap> = {
    [P in K]: { kind: P, v: TypeMap[P]["v"] } & Omit<TypeMap[P], "kind" | "v">
}[K];
```

The definitions of the functions and the other two maps are almost identical to before; we just need to align the parameter type in `FuncRecord`:

```ts
const recfs = {
    n: (n: number) => n * 2,
    s: (s: string) => s.trim(),
    b: (b: boolean): number => (b ? 1 : 0)
};

type OutputMap = {
    [P in keyof TypeMap]: ReturnType<(typeof recfs)[P]>
};

type FuncRecord = {
    [P in keyof TypeMap]: (x: TypeMap[P]["v"]) => OutputMap[P];
};
```

The definition of the `match` function remains unchanged.

[Here](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.3.3#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuAFChIUAMrBUtAOaZcBYmUq0GzAM7sujLbIVCxE6ACEcOADYQAhjSV5CJctTqMmSXdyhJLN+2NxcGgAVRoqHAdsJ1V4ZDRHFQAfaUMaRRiUqAtrO2jlfDFRAHoStRpGeP4koqgtRhk5DNrhX0ZcgIKnNsFgyQAVEIBZWzBVUlEoaagAbQBpKFoocMjuglmmN3wmAF1dxgBRAA9ZWyxgAB5VqNqOVw1GRcEAPjERUX7oADVbKzgILVLosIKcIHQtJQICAcAAzKBDSCjcYkCjQuEIkZjF4TKYzWYABSWNCg8wOam2jAJHB8iIgyMJu02nD2QigADIoAB5BBUK50hkE3YcLYaJhQVJMFkvUSCBa7Yq4GgGKCobCwyEuPHTSpQAAUut4CVQAEpiDiSQAqKAAJjY2vqjD1DXq6XkZqIOK0ADpDAg9Sb7TN2vqkIw-Hl7CaeHw0ObQ1AAPxQACMUEYAAYTbLiqZuXBgGAC8jccHCcSoTD4QKxuTMMA4KgaHTLnrTBi1VgNSbGTKPl8oAAxOA0LC1Uv4onLNFVzFI2tO46MGtgRnMvYenFcgtF4CChU5z6wkcXNZQBC2YBYAAWwKgoOA4PwkJnGJXLz1Ds7Pl+-0BWXwYEXiDGZOw1Rhh1HWpRGjfNC2LMZ5TIL8IAbJtVXVLRZm-b1tl2PUcM4E13iAA) you can find playground with the whole code.

### An alternative to the alternative

To be fair, experimenting with TypeScript and type parameters, I was able to get a somewhat less safe solution that doesn't employ the pattern:

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

type Kinds = UnionRecord["kind"];
type GetValue<K extends Kinds> = (UnionRecord & { kind: K })["v"];
type RecFs<K, V , R> = {
    [KK in Kinds]: KK extends K ? (v: V) => R : (...args: any) => any
};

function processRecord<
  K extends Kinds,
  V extends GetValue<K>
>(record: { kind: K; v: V }) {
    return <R>(fns: RecFs<K, V, R>): R => fns[record.kind](record.v); 
}


// usage
const recfs = {
    n: (n: number) => n * 2,
    s: (s: string) => s.trim(),
    b: (b: boolean): number => (b ? 1 : 0)
};

processRecord({} as NumberRecord)(recfs); // number
processRecord({} as StringRecord)(recfs); // string
processRecord({} as BooleanRecord)(recfs); // number
```

Here, we have expanded the structure of a `record` in the type `{ kind: K; v: V }`, where `K` is the type parameter used to infer the `kind`, and as such, it must be assignable to `"n" | "s" | "b"`. Meanwhile, `V` is the type parameter used to infer the type of the value `v` corresponding to the kind `K`. The type of the structure containing the functions enforces the presence of a function for each `kind`. However, it enforces the correct type of the `v` argument and infers the return type `R` only in the callback corresponding to the `kind` `K`.

I describe this solution as less safe because, despite the upper bounds on the type parameters, we lack certainty that the `record` passed to `processRecord` is indeed a `UnionRecord`:

```ts
// allowed
processRecord({
    kind: Math.random() > 0.5 ? "s" : "n",
    v: Math.random() > 0.5 ? "ciao" : 123
});
```

[Here is a playground](https://www.typescriptlang.org/play?jsx=0&ts=5.3.3&install-plugin=playground-ts-scanner#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuAFChIUAMrBUtAOaZcBYmUq0GzAM7sujLbIVCxE6ACEcOADYQAhjSV5CJctTqMmSXdyhJLN+2NxcGgAVRoqHAdsJ1V4ZDRHFQAfaUMaRRiUqAtrO2jlfDFgyQBpDS1VcMiCpwBtJjd8JgBdExCoAHEIYAA1Wys4CAAeUqgIAA9gCDpK8tmAPlUACmqopMIAMjUmxjHBAEoGzlb2ySUAMS1Rjl6oDnQll1EoV6g60rHaKHn8LRa9mNJtNZj8oAB+KDLHy9A7EJboKCMZYAOjRtlQ8i0jHsIDhRCWuNEIlEogAZnAaFhgDUoGBUDgsBAtFoNsMXmDgTM-j8KmwOXcuaDun0BkNRgtRAtlqgsppXBo9sI9FA7ocyBzXrLgHBUDQoMNHssyTRsVBLtdSrcHgsDoxEQSoCatHVZYUUU0WjK5SjOAdlcTSaIAPTBqBwLS2eQQUS4U3AKBusmVZ5vKA0ZEZ9N8ND4pb6gBUUAATPy02blmaDHIMnmoFoUYYEMsDmW3khkR3fP58nbswkBI7lkgIVAAIxIqAABgOxOK9MZzNZcuWpEEUFslXi-A2B29WGT-qgof7-FEC6ZLI2q-Xm7SNcyhT3Sa0R5P1YU54Zl+XhRvG8qXIAlqAhn2wQ9lRPXgB1JC8l2vUhNXUdwoAAWVsYAAAsUVQex8BwZs4SWKcUQAVlHJgdEnFh2CQnx0KwnC8IIlsoGIsiKKwKhbBwJhJzHYsAGZiQOIA).

### A safer alternative to the alternative of the alternative

At this point I'm just trolling, and no, I have no intention of explaining why this stuff works. I'm afraid I might not even know. Or maybe I do. Who knows.

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

type Kinds = UnionRecord["kind"];
type GetValue<K extends Kinds> = (UnionRecord & { kind: K })["v"];
type RecFs<K, V , R> = {
    [KK in Kinds]: KK extends K ? (v: V) => R : (...args: any) => any
};

function processRecord<
  U extends Extract<UnionRecord, { kind: K, v: V }>,
  K extends Kinds = U["kind"],
  V extends GetValue<K> = GetValue<K>,
>(record: U) {
    return <R>(fns: RecFs<K, V, R>): R => fns[record.kind](record.v); 
}

// usage
const recfs = {
    n: (n: number) => n * 2,
    s: (s: string) => s.trim(),
    b: (b: boolean): number => (b ? 1 : 0)
};

processRecord({} as NumberRecord)(recfs); // number
processRecord({} as StringRecord)(recfs); // string
processRecord({} as BooleanRecord)(recfs); // number

// not allowed anymore
processRecord({
    kind: Math.random() > 0.5 ? "s" : "n",
    v: Math.random() > 0.5 ? "ciao" : 123
})
```

As always, [a playground to play with](https://www.typescriptlang.org/play?jsx=0&ts=5.3.3&install-plugin=playground-ts-scanner#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuAFChIUAMrBUtAOaZcBYmUq0GzAM7sujLbIVCxE6ACEcOADYQAhjSV5CJctTqMmSXdyhJLN+2NxcGgAVRoqHAdsJ1V4ZDRHFQAfaUMaRRiUqAtrO2jlfDFgyQBpDS1VcMiCpwBtJjd8JgBdExCoAHEIYAA1Wys4CAAeUqgIAA9gCDpK8tmAPlUACmqopMIAMjUmxjHBAEoGzlb2ySUAMS1Rjl6oDnQll1EoV6g60rHaKHn8LRa9mNJtNZj8oAB+KDLHy9A7EJboKCMZYAOjRtlQ8i0jHsIDhRCWuNEIlEogAZnAaFhgDUoGBUDgsBAtFoNsMXlBQuMpjM-lAAKJTVC2anDNa1AgcVwaPYcGFCBZsDlAnmg36VEihBpNVpK153YG8yrdPoDIajJ5dHr9QYjUqK0QLZaoLKaUJw0gc14u4BwVA0KDDR7LMk0bFQS7XUq3B4LA6MREEqChrR1F2FFFNFrO10ozgHYRQYmkgD0JagcC0tnkEFEuDDwCg6bJGrIXqgNGRnY7fDQ+KWAYAVFAAEx6t7h5bhgxyDL9qBaFGGBDLA7j15IZGb3z+fLxnsJARJ5ZICFQACMSKgAAYDsTivTGczWa7lqRBFBbJV4vwNgcc1gLYFlAZYHvwoiPkyLIbG+H5fmks6ZIU-7NlowGgTOCgQQyUEvoUsGfpUuQBBK+AodgQGFqBvCHqW5Y0DgjYDFYOAAO4QIQuIIHgtaQc+MGem86juFAACytjAAAFiiwp0DgK5wks14ogArGeTA6FeLDsO2PjiVJMn2Pg8mrlASmqepWBULYOBMFe54jgAzMSBxAA).

&nbsp;

## Conclusion

Expressing correlations has never been this challenging. No need to thank me. But if you really insist, feel free to insult me [on Xitter](https://twitter.com/jfet97).
