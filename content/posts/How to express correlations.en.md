+++
author = "Andrea Simone Costa"
title = "How to express correlations"
date = "2024-01-15"
description = "Expressing correlations has never been so difficult"
categories = ["typescript"]
series = ["TypeScript"]
published = true
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

By design, the code above is certainly correct, but TypeScript is unable to see the correlation between `record.v` and `record.f`. The meaning of the error is quickly explained: TypeScript knows that `record.f` is a function, but it cannot determine which of the three functions it is. Therefore, for safety reasons, TypeScript requires that the parameter be acceptable in every case. It must be both a `number` and a `string` and a `boolean`, but there are no values that satisfy this requirement! The intersection of `number`, `string`, and `boolean` is precisely the `never` type, which has no inhabitants.

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

The type function `RecordType<K>` perfectly encodes the correspondence between the `kind`, the types, and the two related properties. It is defined in terms of `TypeMap`, which keys serve as an upper bound for the type parameter `K`, and is used to correlate the `v` field with the parameter of the `f` function: they both have the type `TypeMap[K]`.

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

In short, what used to be `RecordType` is now directly distributed over a subset `K` of keys in `TypeMap`. The default value of the type parameter is not strictly necessary, but it comes in handy when the whole union is needed.

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

### Extracting the callbacks

To showcase the power of this pattern, let's pull out the callbacks `f` into another structure. You'll see that we can still correlate all of this thanks to our type map:

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
    fs: FuncRecord
) {
    return fs[recv.kind](recv.v);
}
```

We have both `ValueRecord` and `FuncRecord` defined in terms of the type map. `ValueRecord` is based on the "verbose" version, allowing the type parameter `K` to be precisely inferred during the invocation of `processRecord`. On the other hand, the definition of `FuncRecord` can be kept as simple as possible: a non-parametric mapped type whose keys are the same as the type map.

Inside `processRecord`, the kind of `recv` is used to index the corresponding callback within the `FuncRecord` structure, and that function is then invoked on the value `v` of `recv`. [TypeScript doesn't break a sweat](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.3.3#code/C4TwDgpgBAKuEFkCGYoF4oG8BQU9QDsAuQgVwFsAjCAJwBpd8BnEp4GgSwIHMH8pKJSgHthAGwhIC2AL4BubNlCQoANSRjSEAEoQAxsJoATADwBpKBAAewCASNMoAawghhAM1jxkqDC7eecJA+AHzoWFCMeADaAApQXFBmALokOPz8TlxGJLF8GXgAbiRBiChxyVFQMrLRKQpK8FAAYqQEeroGxuGYkfxxCQTOrh5ewSipUAAUViXe5bHJAJToYYXCHEayDe5tesAcwkNgNMJ6EExMnYamFta29o7+o6WhU1U0+sVqGlrXxuYQvk8O4WC09v8tit0vhPsBSDQhqDop89IUAHRZezJKaojGFJYKGrYE5nC5XfQ3d4AempUAAegB+KowgpYnJQABEBE5wIy3wAjAAGKoyPm9Kr8YjTAmrKAGAhMcQQdFiYTcKaFKAAKigwqWdD6BSgYM1KzQYQVSokqvVmvRn0gSGAUwATEsDUaCoIZebLUdrSq1RrlBBRlq0JGuSJlVJOUtRdgE0A).

&nbsp;

## A more complex problem

Let's go back to the initial definition of records, which now only contains data. Suppose we now want to invoke a specific function on each value `v`. Each function might have its own return value, potentially different from the others. The goal is to define a matching function that, given a `UnionRecord`, calls the corresponding callback on its `v` property and returns the returned value with the correct type.

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

const recfs = {
    n: (n: number) => n * 2,
    s: (s: string) => s.trim(),
    b: (b: boolean): number => (b ? 1 : 0)
}

function match(record: UnionRecord, fs: ??): ?? {
    // ??
}
```

### Attempt #1: overloads

One initial solution to the problem involves combining a `switch` statement with the necessary overloads for the `match` function.

In `FuncRecord`, the type of each parameter must be aligned with the corresponding `v` field's type, otherwise we couldn't invoke such callbacks. The return type will be arbitrarily determined by the caller of `match`, therefore we set `unknown` here. We plan, in fact, to use `FuncRecord` as an upper bound and to infer the types of the matching callbacks (`FS`).

The main issue with this approach is the presence of __implicit__ type assertions: there's no guarantee that the implementation adheres to the indications of the overloads's signatures. [Seeing is believing](https://www.typescriptlang.org/play?ts=5.3.3#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuALAAoUJCgBlYKloBzTLgLEylWg2YBndl0Y75SoWMnhoAIRw4ANhACGNFXkIly1OoyZJ93KEg29k6mElLQAKo0VDjO2K7q8MhoLmoAPrLGNMrx6VDWdo5xqvhmYRZQAGJwNFipbmQSUM1QANroULRQUTHFCQ46UOitTJ74TAC6E4wAFP4zPbH1UABkGmOMw6Nak0IAlCOck3vEAHxQNRQ0OADuNGaCEhIAZjVYwL1QCA7AWAAWAB5KjIoBAAB7ACB0QbVWr1U4zVC5bRJfj1DjPHSMYF7TYQYBwVA0AAqFiBMhGrAmpxebw+sS+P3+5NBEKh+Bhb3hiORjDkCmy6KgmOxMlxQ3xhJJZOBIz01NptXpNEZv0BwNZkOhVS5yIRSJKjAKwT6BAxWKqYrxBKJpMg5JGvgV4leSs+3zVLPBWo5Orhep5hu60SWyPNopOpCaLSRNpVMhAyDsMyYN2AzyYewkgiAA). Also, the `switch` itself is a bit redundant, but unfortunately we can't just go with `fs[record.kind](record.v)`, not without resorting to the pattern at least.

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

type FuncRecord = {
    [R in UnionRecord as R["kind"]]: (v: (UnionRecord & { kind: R["kind"] })["v"]) => unknown;
}

function match<FS extends FuncRecord>(record: NumberRecord, fs: FS): ReturnType<FS["n"]>
function match<FS extends FuncRecord>(record: StringRecord, fs: FS): ReturnType<FS["s"]>
function match<FS extends FuncRecord>(record: BooleanRecord, fs: FS): ReturnType<FS["b"]>
function match<FS extends FuncRecord>(record: UnionRecord, fs: FS) {
    switch(record.kind) {
        case 'n': return fs["n"](record.v)
        case 's': return fs["s"](record.v)
        case 'b': return fs["b"](record.v)
    }
}
```

### Attempt #2: messing with the return type

Here again we are dealing with type assertions, this time explicit, with all the risks that come with them. TypeScript doesn't yet support control flow analysis to refine a parametric type: the type of the `record` is refined within the cases of the `switch`, but the same doesn't happen to the type parameter `R`. But even if that were the case, accessing with a concrete index in `fs` breaks all ties with the type parameters. For example, `fs["n"]` is inferred as `(v: number) => unknown`, that is its constraint.

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

type FuncRecord = {
    [R in UnionRecord as R["kind"]]: (v: (UnionRecord & { kind: R["kind"] })["v"]) => unknown;
}

function match<R extends UnionRecord, FS extends FuncRecord>(record: R, fs: FS): ReturnType<FS[R["kind"]]> {
    switch (record.kind) {
        case "n":
          return fs["n"](record.v) as ReturnType<FS[R["kind"]]>;
        case "s":
          return fs["s"](record.v) as ReturnType<FS[R["kind"]]>;
        case "b":
          return fs["b"](record.v) as ReturnType<FS[R["kind"]]>;
    }
}
```

### A wrong final attempt

It's necessary to resort once again to the pattern discussed in this article. The solution is a generalization of the [extracting callbacks case](#extracting-the-callbacks), where now each callback has its own return type. Let's first analyze an initial attempt, which, however, will turn out to be wrong:

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

type FuncRecord = {
    [P in keyof TypeMap]: (v: TypeMap[P]) => unknown;
};

function match<K extends keyof TypeMap, FS extends FuncRecord>(
    recv: ValueRecord<K>,
    fs: FS
): ReturnType<FS[K]> {
    return fs[recv.kind](recv.v);
}
```

[Link to the playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=5.3.3#code/C4TwDgpgBAKuEFkCGYoF4oG8BQU9QDsAuQgVwFsAjCAJwBpd8BnEp4GgSwIHMH8pKJSgHthAGwhIC2AL4BubNlCQoANSRjSEAEoQAxsJoATADwBpKBAAewCASNMoAawghhAM1jxkqDC7eecJA+AHzoWIwA2gAKUFxQZgC6JDj8TlxGJNEK-ABuJEGIKDGJOVDyspFJCkrwUABipAR6ugbG4alQMXEEzq4eXsEoyVAAFPmDRWAlAJToYU1OBMIA7gQKFdjuTXrAHMK95EjAegAW5pY2dg59AZM+dA0Aype29o6Nza2GRiGjjDR9BN1JodPofuYQnwoO4WM9sDMSLpgKQaARCiZ6k8qokwp1ASi0TCmJFAXpcgA6dL2RKjMmU3IzDaKAwENhQMmwjqMPDEMZ8ggUag0OZoMK9ABUUAATNC8HDRnC2JweKKwkwKewOORRjM5QISKNBAJRBIpIiyFRaPMxpQoAB+KAARigJAADDNZIojidTqNMM4MiQAEQEYOPCYAFml5UenKYnoA9ImoAA9e3YH1nf2B+whpjhqATYN6DhIYTB2Mc-SwpMp9OZ47ZgPUzJQYOUQsTdwaJjQGRxmsJ7DJtP2oA).

`ValueRecord` is defined in the same wordy way as before, whereas `FuncRecord` is nothing more than a mapped type based on the keys of the type map. Inside the match function, the kind of `recv` is again used to index the corresponding function within `fs`, and this function is then invoked on the `v` value of `recv`. The type returned by `match` is expressed in terms of `FS`, as it was in the previuous attempts.

Unfortunately, however, we encounter an error: the type of `fs[recv.kind]` has been inferred as `never`, and `string | number | boolean` is not assignable to parameter of type `never`. What a drag. What's the problem now?

We have two main issues:

1. we declared the type parameter `FS` to infer the return type of the matching callbacks, so that the `match` function can be more flexible. It is true that the upper bound of `FS`, namely `FuncRecord`, specifies the input types as a direct dependency of the type map, but it seems like this connection gets lost with `FS`, which is a generic subtype of it. This loss could be related to variance, as variance rules allow passing callbacks whose input type is a supertype compared to what is declared by `FuncRecord`.
2. we broke again all the ties with the type parameters, so the inferred return type is once again `unknown`.

### The right final attempt

The solution I propose to overcome these issues is based on a [recently merger PR](https://github.com/microsoft/TypeScript/pull/55811) and will work from version `5.4` of the language:

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

function match<K extends keyof TypeMap, FS extends Record<keyof TypeMap, any>>(
    recv: ValueRecord<K>,
    fs: { [K in keyof FS & keyof TypeMap]: (v: TypeMap[K]) => FS[K] }
) {
    return fs[recv.kind](recv.v);
}
```

We need the ability to infer the returned types from the matching callbacks, but we cannot use a type parameter that directly matches them for the reasons explained above. We have to be sure to keep the relationship with the type map.

We can use a __reverse mapped type__ to get things done. We keep the type parameter `FS` for this very purpose: to be the target of the inversion. The upper bound of `FS` ensures that `fs` will have __all__ the keys specified in the type map, while the intersection in the reverse mapped type with `keyof TypeMap` ensures that `fs` will have __only__ the keys specified in the type map.

The keys' type we specify in the reverse mapped type is kinda special: we have to use `FS[K]` somewhere to make sure there's a candidate for each key `K` from which the reverse mapped type can figure out the actual type of `FS[K]`. We use that as return type for the matching callbacks because we need to infer those ones exactly, while we set the input type to `TypeMap[K]` as expected.

[Playground](https://www.typescriptlang.org/play/?target=99&jsx=0&ts=5.4.5#code/C4TwDgpgBAKuEFkCGYoF4oG8BQU9QDsAuQgVwFsAjCAJwBpd8BnEp4GgSwIHMH8pKJSgHthAGwhIC2AL4BubNlCQoANSRjSEAEoQAxsJoATADwBpKBAAewCASNMoAawghhAM1jxkqDC7eecJA+AHzoWIx4ANoAClBcUGYAuiQ4-PxOXEYkMQrp+ABuJEGIKLFJefjyslHJCtjupAR6wBzCBFDkSMB6ABbmljZ2Ds6uHl7BKHRQAGIAyoO29o66BsYm-uMlPtNSICEhABSRUDT6RWoaWquGpmYhfPjuLFhQtfEdm57zUABkowEJqUwCkoIcLtsyskAJToMLzWpJKAybCwtL4M7AUg0DrPKJnPQFAB0mXsSUOBOJBWhChR2AMBDYp30z3C6LwxDBnIIFGoNFhaDCHQAVFAAEyPPAvQ4vNicHgCsJMInsDjkQ7QyUCEiHQQCUQSKTQkg8qi0OFgyhQAD8UAAjFASAAGaGyRQMplnJgAfQ6GC6PV6h0wziyJAARARw9MLgAWMXI6YE56ugD0qf4AD1rfT2p6ID7HP7un1g6H7BGmNGoBdw3oOEhhOHE8y9CnsOmszmPcBmT6rcXA2XSdkoOHKNWLu4NExoDIkyymGmM-hs0A).

We could simplify further this snippet by completely removing the verbose definition of `ValueRecord`:

```ts
function match<K extends keyof TypeMap, FS extends Record<keyof TypeMap, any>>(
    recv: { kind: K; v: TypeMap[K] },
    fs: { [K in keyof FS & keyof TypeMap]: (v: TypeMap[K]) => FS[K] }
) {
    return fs[recv.kind](recv.v);
}
```

[Playground](https://www.typescriptlang.org/play/?target=99&jsx=0&ts=5.4.5#code/C4TwDgpgBAKuEFkCGYoF4oG8BQU9QDsAuQgVwFsAjCAJwBpd8BnEp4GgSwIHMH8pKJSgHthAGwhIC2AL4BubNgBmpAgGNgHYQSjkkwNQAsAPAGkoEAB7AIBACZMoAawghhS2PGRg6UAGIAyhbWtg5QAEoQasI0dsYubh5wkN6+UiAAfBkAFIx4NFEAbiSYzlx2JKZyUMWeKSgA2qYAulAyfPhKLFhQTVBczq7u-kEAZIOJdYgozSTZtcnTYE3NAJToGSMrbdjrOPwFwKQ0Ol0NBWqFAHRO5c3ZF9eFqwoyitEEbFAXXehYeYQ5sQyFRaOs0JsdAAqKAAJg6eG62W6bE4PHBmyYV3YHHI2VWCIEc0EAlEEikqxIBAo1BoGyg2UoUAA-FAAIxQEgABlWsne2i+BSYAH0dBg9AZDNlSrd7CQAEQEeW+WoAFlhbV8PyYvIA9Lr+AA9ZnYD6CiAixzi-RGaVlOVQeVMZU1BVqDhIYTyzXfKJdPUG-DG00C4C+kVM62Su2yiqOygu2pKJBiJjQdq+tT+7D6o3MoA).

No one can force us to obfuscate the code after all!

&nbsp;

## What I don't like

It is usually more idiomatic to first define the components of a (discriminated) union and then create the union using the `|` operator, rather than encapsulating everything in a complex and obscure type function, as done with `ValueRecord`:

```ts
// idiomatic:
type NumberRecord = { kind: "n"; v: number };
type StringRecord = { kind: "s"; v: string };
type BooleanRecord = { kind: "b"; v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;


// suggested by the pattern:
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
```

It's worth noting that it's not always feasible to straightforwardly apply this latter approach, especially when the union's components have different structures. We are forced to abuse the type map, and things quickly go south.

### An alternative

My efforts have focused on keeping the definitions of `UnionRecord` components separate, as is idiomatic. The rest remains almost unchanged.

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

Let's keep the verbose `ValueRecord` to show a problem that arises in its definition, and how to solve it. We are forced to manually define the types of the `kind` and `v` fields, always based on the type map, because these two fields are the ones directly accessed by the match function. The type `{ kind: P, v: TypeMap[P]["v"] } & Omit<TypeMap[P], "kind" | "v">` is conceptually identical to `TypeMap[P]`, but TypeScript gets lost within `match` if we use the latter. Note that in this specific example, the intersection with `Omit<TypeMap[P], "kind" | "v">` could be omitted since records don't have any other properties besides `kind` and `v`.

``` ts
type ValueRecord<K extends keyof TypeMap = keyof TypeMap> = {
    [P in K]: { kind: P, v: TypeMap[P]["v"] } & Omit<TypeMap[P], "kind" | "v">
}[K];
```

After that, we just need to align the parameter type both in the `match` function:

```ts
function match<K extends keyof TypeMap, FS extends Record<keyof TypeMap, any>>(
  recv: ValueRecord<K>,
  fs: { [K in keyof FS & keyof TypeMap]: (v: TypeMap[K]["v"]) => FS[K] }
) {
    return fs[recv.kind](recv.v);
}
```

[Here](https://www.typescriptlang.org/play/?target=99&jsx=0&ts=5.4.5#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuAFChIUAMrBUtAOaZcBYmUq0GzAM7sujLbIVCxE6ACEcOADYQAhjSV5CJctTqMmSXdyhJLN+2NxcGgAVRoqHAdsJ1V4ZDRHFQAfaUMaRRiUqAtrO2jlfDFRAHoStRpGeP4koqgtRhk5DNrhX0ZcgIKnNsFgyQAVEIBZWzBVUlEoaagAbQBpKFoocMjuglmmN3wmAF1dxgBRAA9ZWyxgAB5VqNqOVw1GRcEAPjERUX7oADVbKzgILVLosIKcIHQtJQICAcAAzKBDSCjcYkCjQuEIkZjF4TKYzWYABSWNCg8wOam2jAJHB8iIgyMJu02nD2QigADIoAB5BBUK50hkE3YcLYaJhQVJMFkvUSCBa7YqwuA0C5rKAIWzALAAC2BUFBwHB+EhaJh8IFYw4ADEpPqwRCoEDTRiLWAOPYQC8XgAKPGobA+X7-QFZfDAl5sPGwhpqBbEqFmqA2jkJl1YsDk7209Py5l7ACUxBxNvlQlEhcmMyg-uAcFQJOjs39WE4ADptrtvc225x8+9PqVynAtLZ5BBRLgaAZq9ho7iq5UoN7F7wEqhC0QcSSAFRQABMkarMe9MYMzXkG5xWlbhgQ3vzh5mSEY3ufvn8+XzPD4aCLS6QUAAPxQAAjFAjAAAz5rKxSTtO-paAA+iSJAalq2reg87jMKwNKMAALHuQgcM20bQWUVYAHqAROUTwRASGQqhmo6ph6jYUwOh4cwWBULYODioIJGzlo5HlDM1G0VOwAzkhAHMehbGUswXjcbCfxaNAQkzlgZGDlRgFAA) you can find playground with the whole code.

If you want to get rid of `ValueRecord`, you still have to define the `kind` and `v` fields manually in the `match` signature:

```ts
function match<K extends keyof TypeMap, FS extends Record<keyof TypeMap, any>>(
  // equivalent to TypeMap[K] but TS gets lost again
  recv: { kind: K, v: TypeMap[K]["v"] } & Omit<TypeMap[K], "kind" | "v">
  fs: { [K in keyof FS & keyof TypeMap]: (v: TypeMap[K]["v"]) => FS[K] }
) {
    return fs[recv.kind](recv.v);
}
```

[Playground.](https://www.typescriptlang.org/play/?target=99&jsx=0&ts=5.4.5#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuAFChIUAMrBUtAOaZcBYmUq0GzAM7sujLbIVCxE6ACEcOADYQAhjSV5CJctTqMmSXdyhJLN+2NxcGgAVRoqHAdsJ1V4ZDRHFQAfaUMaRRiUqAtrO2jlfDFRAHoStRpGeP4koqgtRhk5DNrhX0ZcgIKnNsFgyQAVEIBZWzBVUlEoaagAbQBpKFoocMjuglmmN3wmAF1dxgBRAA9ZWyxgAB5VqNqOVw1GRcEAPjERUVEAMzgaC7WoAhbMAsAALS6LCCnCB0LSUCAgHBfKBDSCjMAcABiUigUOAMPwcNqlwoCKRKJGYw49hALxeAAoplBUNgfA93FB5hwfKiIOiFrtNpw9kIoAAyKAAeQQVCuvP5812HC2GiYUFSTGFLzYTK+DTUCyWNHhiOR2PFJvJ8rGByg9J5lLAAqFewAlMQXlBsQKhKJ3ZMZsyIMA4KhjXrZiysJwAHTbXb0qOxziu96fUrlOBaWzyCCiXA0AxBrB6iZM6aVO2V3gJVDuoie40AKigACYdYH9fT9QZmvJ656tDHDAh6a6OzMkIx6VPfP58q6eHw0B67UgoAB+KAARigjAADK7RB981EiyytAB9Y0kIEg0H09maFjeRgAFlbQg4Ub1R7KgYAPQ3U9C2AIMrzhW9gTBR91A5JgdG5DwsCoWwcDVQRv2wX8M0A4CC3PCAr3XKD71g7YPC8JCoC+WwrC0aBMOLHD-xmICgA)

&nbsp;

## Is the pattern really needed?

For this specific situation I was able to get a different but still quite contrived solution that doesn't employ the pattern at all:

```ts
type NumberRecord = { kind: "n", v: number };
type StringRecord = { kind: "s", v: string };
type BooleanRecord = { kind: "b", v: boolean };
type UnionRecord = NumberRecord | StringRecord | BooleanRecord;

type Kinds = UnionRecord["kind"];
type GetValue<K extends Kinds> = (UnionRecord & { kind: K })["v"];
type RecFs<K, V, R> = {
    [KK in Kinds]: KK extends K ? (v: V) => R : any
};

function match<
    K extends Kinds,
    V extends GetValue<K>
>(record: { kind: K; v: V }) {
    return <R>(fs: RecFs<K, V, R>) => fs[record.kind](record.v); 
}
```

[Playground](https://www.typescriptlang.org/play/?jsx=0&ts=5.3.3&install-plugin=playground-ts-scanner#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuAFChIUAMrBUtAOaZcBYmUq0GzAM7sujLbIVCxE6ACEcOADYQAhjSV5CJctTqMmSXdyhJLN+2NxcGgAVRoqHAdsJ1V4ZDRHFQAfaUMaRRiUqAtrO2jlfDFgyQBpDS1VcMiCpwBtJjd8JgBdExCoAHEIYAA1Wys4CAAeUqgIAA9gCDpK8tmAPlUACmqopMIAMjUmxjHBAEoGzlb2ySUAMS1Rjl6OdCWXUSgXqDrSsdooefwtFr2xpNprNvlAAPxQZY+XoHYhLdBQRj2ECiESiUQAMzgNCwwBqUAQtmAWAAFsNnqCgTNft8KmwKb1xlNqZVun0BkNRgtRAtlqgsppXBo9sI9FBGYcyBSXvzgHBUDQoMMHssMVpGJdrqVbvcFrCiEs1XV+YUAHRNFp8gWmzgHUWo9GiAD0TqgcC0tnkEFEuBoBigJrVqlI0qgNEYy3DYb4aH1S0VACooAAmemvKDqyGZgxyDJxjOmwwIZYHNOvJARiu+fz5A48GMCA2QpDgqAARkRUAADAdUcVff7+VoAPqKkiE4kk5akQRQWyVeL8DYHK1YNV252u14APTBPqig4gI8q46JpOns-naVzmUKK8DWg3LvTu-3fuAAaPw5bp8nF7nlS5AEtQEPe2DrmIz47nuogTueIbprsUAALJEiSpqoPY+A4MWsJLF2poAKytkwOidiw7Chj4qHAOhmF0DhJZQPhREkVgVC2DgTCdm2yYAMyogcQA).

Here, we have expanded the structure of a `record` in the type `{ kind: K; v: V }`, where `K` is the type parameter used to infer the `kind`, and as such, it must be assignable to `"n" | "s" | "b"`. Meanwhile, `V` is the type parameter used to infer the type of the value `v` corresponding to the kind `K`. The type of the structure containing the functions enforces the presence of a function for each `kind`. However, it enforces the correct type of the `v` argument and infers the return type `R` only for the callback corresponding to the selected `kind` `K`.

This solution is a bit less safe because, despite the upper bounds on the type parameters, we lack certainty that the `record` passed to `match` is indeed a `UnionRecord`:

```ts
// allowed
match({
    kind: Math.random() > 0.5 ? "s" : "n",
    v: Math.random() > 0.5 ? "ciao" : 123
});
```

To fix this problem, is sufficient to intersect the `record` parameter with `UnionRecord`:

```ts
function match<
  K extends Kinds,
  V extends GetValue<K>,
>(record: UnionRecord & { kind: K, v: V }) {
    return <R>(fs: RecFs<K, V, R>) => fs[record.kind](record.v); 
}
```

As always, [a playground to play with](https://www.typescriptlang.org/play/?jsx=0&ts=5.3.3&install-plugin=playground-ts-scanner#code/C4TwDgpgBAcgrgWwEYQE4CUIGMD2qAmUAvFAN5QDWAlgHb4BcUARDUwDRQBujNiKqUAL4BuAFChIUAMrBUtAOaZcBYmUq0GzAM7sujLbIVCxE6ACEcOADYQAhjSV5CJctTqMmSXdyhJLN+2NxcGgAVRoqHAdsJ1V4ZDRHFQAfaUMaRRiUqAtrO2jlfDFgyQBpDS1VcMiCpwBtJjd8JgBdExCoAHEIYAA1Wys4CAAeUqgIAA9gCDpK8tmAPlUACmqopMIAMjUmxjHBAEoGzlb2ySUAMS1Rjl6OdCWXUSgXqDrSsdooefwtFr2xpNprNvlAAPxQZY+XoHYhLdBQRj2ECiESiUQAMzgNCwwBqUAQtmAWAAFsNnqCgTNft8KmwKb1xlNqZVun0BkNRgt6Qtlqgspo1rUVNtXBo9hxoUJYaQKS9+cA4KgaFBhg9lhitIxLtdSrd7gtYUQlpq6vzCgA6JotPkCi2cA7CKCo9GiAD0bqgcC0tnkEFEuBoBig5s1qllrygNEYy2jUb4aCNSxVACooAAmemRrWQnMGOQZJNQLQWwwIZYHLOvJAxmu+fz5A48BMCY2QpDgqAARkRUAADAdUcVA8H+VoAPoqkiE4kk5akQRQWyVeL8DYHW1YTWO92e14APTBAaio4gE8q06JpPni+XaQLmUKG9DWh3Hsjh+PQeAIbP447l6zjeS6VLkATCvgz7YNuYjvgeR6iDO14Rq8uxQAAskSJIWqg9j4Dg5awksfYWgArJ2TA6L2LDsHKegYVhOF4QRFZQMRZEUVgVC2DgTC9l26YAMyogcQA).

&nbsp;

## Conclusion

It's not always possible to avoid the pattern discussed in this article just by hammering type parameters in the right places. If it were that simple, they wouldn't have gone to the trouble of implementing it. However, it's always worth trying to find alternative solutions that are more idiomatic and less complex. The pattern is a powerful tool, but it's not always the best one. I hope, however, that this example has been thorough enough to cover almost all the details of it.

Expressing correlations has never been this challenging. No need to thank me, but if you really insist feel free to insult me [on Xitter](https://twitter.com/jfet97).
