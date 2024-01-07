+++
author = "Andrea Simone Costa"
title = "How to express correlations"
date = "2024-01-07"
description = "Expressing correlations between different entities has never been so difficult"
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

We'll examine an instance of the problem it solves and how to exploit it in a masterful way in the specific case. Regardless of my opinion, it remains an invaluable tool to include in your toolbox, and often the only one to tackle certain situations. I will then explain what I dislike and propose a solution to mitigate these difficulties.

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

By design, the code above is certainly correct, but TypeScript is unable to see the correlation between `record.v` and `record.f`. The meaning of the error is quickly explained: TypeScript knows that `record.f` is a function, but it cannot determine which of the three functions it is. Therefore, for safety, TypeScript requires that the parameter be acceptable in every case. It must be both a `number` and a `string` and a `boolean`, but there are no values that satisfy this requirement. The intersection of `number`, `string`, and `boolean` is precisely the `never` type, which has no inhabitants.

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

By defining everyting in terms of the `TypeMap` type, TypeScript is finally able to see the correlation. [Here](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.3.3#code/C4TwDgpgBAKuEFkCGYoF4oG8oDsBcuArgLYBGEATgDRQDOBtwFAljgOY2kGkD2PANhCQ4oAXwDcAKEmhIUAEoQAxjwoATOJAA8AaSgQAHsAg41tKAGsIIHgDNY8ZGAB86LFElRLrNQR01PKAA3Ak1EFABtHQBdAK9bAgAKEIdIJyjogEp0VyCeZjUPCWlZaABVHGYeHEUVdTda1Q14LQByHFbXAB8FZSawttpOqB7G9QHW0k6pSVtCHCVgKpEwCh4lCFpaMbVdfSMTM0trO1Twl0SKPvUCHYGdZ2zMQK8rurUAOltL68+gzPEXgA9ECoAB5CySUSSIA) you can find a playground with the whole code.

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
