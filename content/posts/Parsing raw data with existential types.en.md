+++
author = "Andrea Simone Costa"
title = "Parsing raw data with existential types"
date = "2024-07-17"
description = "How to parse raw data with TypeScript using existential types as result type"
categories = ["typescript"]
series = ["TypeScript"]
published = true
tags = [
    "existential types",
    "parsing",
]
featuredImage = "/images/existentials/copertina_1.png"
images = ["/images/existentials/copertina_1.png"]
+++

_Disclaimer: parsing and validation of raw data is already well taken care of by libraries like [Zod](https://zod.dev/), [effect/schema](https://github.com/Effect-TS/effect/tree/main/packages/schema) and many others. The goal of this article is simply to provide another perspective on existential types._

## Brief intro on existential types

To existentialize a type variable means to abstract over it.

> Existential types can be used for several different purposes. But what they do is to "hide" a type variable on the right-hand side.
>
> -- <cite>[wiki.haskell.org](https://wiki.haskell.org/Existential_type)</cite>

Existential types allow you to hide the implementation details of a structure, [leading to abstract data types](https://homepages.inf.ed.ac.uk/gdp/publications/Abstract_existential.pdf). We can also use them to convert a more specific type into a less specific one. Here I'm gonna use them for something slightly different: to type raw structure after having parsed it.

Unfortunately TypeScript doesn't support existential types out of the box, but we can encode them using universally quantified types. Let's existentialize the `T` type variable of the `Array<T>` type:

```typescript
type ArrayE = <R>(cont: <T>(ts: Array<T>) => R) => R
```

You should read the above mess as `∃T. Array<T>`. Note how the type variable `T` is hidden on the right-hand side of the definition. The meaning of such encoding is the following: something of type `∃T. Array<T>` is equivalent to an higher-order function that takes a continuation `cont` as argument, passes to it an array of `T` and returns the result of the continuation. The continuation represents the `Array<T>`'s client, which cannot assume anything about the internal content of the array, but can still operate on it and return whichever result it wants.

To give you something of type `ArrayE` means to give you an array containing only values of parametric type `T`, which you do not know. You can still operate on the array, but you can't know the type of its elements. If the abstracted type were the implementation type of a structure you could operate on the structure without knowing its internal details.

Let's see a simple example of `ArrayE` in action:

```typescript
function doLogPushPop(arrayE: ArrayE) {
  arrayE(ts => {
    // ts has type Array<T> here
    const el = ts.pop()
    if(el) ts.unshift(el)
    console.log({ ts })
  })
}
```

The function `doLogPushPop` takes an `ArrayE` and set the continuation to pop an element from the array, unshift it back and then log the array. The client of the `ArrayE` doesn't know the type of the array's elements, but can still operate on it.

## Parsing raw data

Let's say we got some raw data from somewhere and we want to parse it. In particular, we want to parse an array of unknown entities and __we want to be sure they all are of the same type__:

```typescript
function parseRawArray<T>(xs: unknown[]): Array<T> {
  // does same-type checks on xs and returns what?
}
```

A problem of the above function is that there exists only one inhabitant of the `∀T.Array<T>` type, which is the empty tuple. We cannot craft an alternative value of type `Array<T>` for every possible `T` out there starting from an array of unknowns. Another problem is that the client of `parseRawArray` shouldn't be able to set the type `T` of the array's elements. Without making further assumptions they don't know the actual type of the raw data. The compiler doesn't know it either because it's something that can only be known at runtime, so we need to find a way to abstract over it.

We can use existential types to solve this problem:

```typescript
function parseRawArrayE(xs: unknown[]): ArrayE /* ∃T. Array<T> */ {
  if(xs.length === 0) {
    // if xs is empty we provide an empty tuple
    return cont => cont([])
  } else {
    // does same-type checks on xs, throw if something is wrong
    // but provides xs itself to the continuation if everything is fine
    return cont => cont(xs)
  }
}
```

We solved the problem by returning an `ArrayE` instead of an `Array<T>`, because now the type variable `T` is not free anymore, but bound by the existential quantifier. The client of `parseRawArrayE` can operate on the array, being sure all its elements have the same, unknown, type.

[Play with existential types in the playground](https://www.typescriptlang.org/play/?target=7&jsx=0&install-plugin=playground-ts-scanner#code/PTAEBcE8AcFNQIICckENIFFQF5SGAiAFQDpEV0AeAgPgCgo5S1MdRyAlKgCgGMB7AO3AAuVtU7gAziORNKVAJQ4qoNouzK2NGiFABXcAEsANgaigAZrv7dDAiL1DcAFrG4BrUAfMQA7g4BSAMqgvABGAFaukqBOqABu8OAuoBKoALaJMLA0lta2-J4SAPIRGACOuqhGBLycEry6SNywImGRNgA0oAAmsBLCIRFRigDeNKCe3pwl7eBEAOaw4AAKSLzg61lF5nUNTbCKAITYuDNRC0ur65tw25y9-fKj4xOgSEuNBeZVErAA3C8AL5aCY6RbgUBVIygTi8Hz8RTQNZwJBmfjpPqQ-jdFKQNKhXhGCQhbwEpKDWYSF58fj9FJ7ZpXaDE3BsWDmIznOH8ADSsEgEl2jWa8mpAjpDxWyJZKnZnJsRG5fIF9z64FFYtphNgRCMvHmQv2TIkXUlxo1oLAzlcHi8oDJTgpUWJsQSEGSqQyoH4unxsCQJNASN4KMMfRedsNjOlutg-Hm5OOuDNMc58aSz1ebw+SC+P3+QJBoB07htk0hRmhwdDBkxqGx7tgBgDD24SAM0A2SGJqHejZSGJe5l4Ac4nIh1cD9WFsHNoDGWZpdOn+wAIn1uCwzgrwUV4Uz-VB1xI2x2u1HYF1q-IAYvxRDJcfN6chjulnv+AfUZAn+3OyPVX6K9kRvItLXdAxiUnSDQDSSCJAMeNPAKSUunqekZ0KHovHMf04whJJ608cAXgmLxOEOR8N0zLNs3AT4LHzUjQGBZjyOY156FgXhvBXZon0OIg4iqXR4BOXAACI2iiCTQAAMjkjiJi4niejVJ8hJEsSTlAKTX3AWSFKUjC1w3QThKMUTQCTb1dEreTFNoiYqJPTTLPgGyfXsoynMOSCZnKSpqlqPjYAEtzRNNdSNwig5mJorN3no3NGKJbIs1YrN2KciAslU0LwosqzxN03IbAMARDMcpyVO8FzuFinAdIksr8iq4ySxcdxQFgBJBCCoNkUPWtiVU1qKtpJS-OKUoKiqGoL0KrSov6DSirirMEteJKGO+NLmMy14dCqd5UG6SBHC6txYBxO0kn5e11kdXt4HG8UQgDaSbCpLMdCe-0fEgxIXAutJdDpV1gfgT14CRAw4MMN0uNANidlqkz+LMxqbPR+rzK00UnIXWidpSvbfgOsDy04YyMbCrGaXMAx5kaVBQk5aydPqohGeZ1n2fgAAfQXaYKrG419f02Y5mzuYljI0AF0BhdFhl6ZPQSfHbcBpY8rnotcrXTF15WRZy4swHCcGIWtbq7R8FwClQUBwXAf0YV+cA3aQRQYLsULaZ0UwsLsSV7F4Lp6xxOIDGaBJu1QWnFqx8EmtwKxeiZ-gbqOHTAPADTU5KjP2UQnPTaTsWNaIT2070bFS+z7pc9wfONNr4uG6znP4vnJTSbzNLb1eYEJlHlHwNC40sRxFMQxdeIoYHL00wTJwOheHR0Ln5lHHrAByCFIdgkdYaG1ERqLAeICQUSAVYnRoF7X4sUhMgLqjy6bWJO1TGJWBOQZEED2Psql7rL0yHAHIVhyp2Cft2WAbBUA+BkOgTgAAPKQ9c3D8G5AAbQALryGkO-LAxNyKYNjOmJwzxmJLgIrwNkAxUHMFwDSCE6hHACHABgiQhNXio14UQXq-pIAYKUKAdBdcvJGCeH3JynUyzDgDHDBGBg3QyNAOtH6JMcwFA2EwymWZmI6Hwu2Po+9cpwB4joiY9CICYJYJQtIqBoDiM4ejdBFpXjZVouAShIikBiP8RIkJNk9KzCqg4zmkk3r8AkvwiYW1wK2w8Mowa8NTDqPgLg-gABaTR2ilL2KZt2cAAB9EJuBPESDwQABgIUpci-iJDCPjsEqRHjOk6VKf0SpXjknbT0fYQxTlx5jx6mleRtFFHdXSV9aIn84m2J8TsWmlD3jdF0M0TgnBoDoK6NwLxEj9kOUKAFOawU9lSNQKNfShybl3NmIoAA-I4KRIgZGJNeIMiY18DFLCUuMliVMkhrB8N6WAEKMAoAAi1BoDZug4TwoIHqghzESASUCSZL9iZ-OGewiR7DOCEP4cCVi2gwDg1QIsLQ9j4G-G6CwrAuAGWIOQSwklLwRjegxCICSCBsSnQkpHRYIgABMABGFiG8Jg8vRBkflgr0QishGK0A4qADMMruW8sVbpAAMts1AqqaUtFAJqgArDqohdL7xBmfjdZl4qWBsqQSg9+JLJVdHFV0TVtroF5Amj0XgBr9TLHBk4ZYIZOC9iYBgEh8aaJxvQBgcQLJlB4q4bSCEACWCSCINAGN3zyIAMUAWqwEgnBeB4WWqmS5tS6n1JwHl0RARktFKxboobw2RujW4tlTLSGim7WG+YEaq39r2Y6od8bxWiiAA)