+++
author = "Andrea Simone Costa"
title = "Parsing raw data with existential types"
date = "2024-07-17"
description = "How to parse raw data with TypeScript using existential types as result type."
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

_Disclaimer: parsing and validation of raw data is already well taken care of by libraries like [Zod](https://zod.dev/), [effect/schema](https://github.com/Effect-TS/effect/tree/main/packages/schema) and many others. The goal of this article is simply to provide another perspective on existential types. The idea for this article came from [here](https://www.cs.ox.ac.uk/projects/gip/school/tc.hs), where the technique I'm going to present is used to type a function from untyped to typed lambda calculus._

## Brief intro on existential types

To existentialize a type variable means to abstract over it.

> Existential types can be used for several different purposes. But what they do is to "hide" a type variable on the right-hand side.
>
> -- <cite>[wiki.haskell.org](https://wiki.haskell.org/Existential_type)</cite>

Existential types allow you to hide the implementation details of a structure, [leading to abstract data types](https://homepages.inf.ed.ac.uk/gdp/publications/Abstract_existential.pdf). We can also use them to convert a more specific type into a less specific one. Here I'm gonna use them for something slightly different: to type raw structure with parametric nature after parsing, i.e. **to get a parametrically typed entity from an untyped source**.

Let's try to understand what it would mean to existentialize the `T` type variable of the `Array<T>` type:

```typescript
type ArrayE = ∃T.Array<T>
```

Note how the type variable `T` is hidden on the right-hand side of the definition. To give you something of type `∃T.Array<T>` means to give you an array containing only values of parametric type `T`, which you do not know. You can still operate on the array, but you can't know the type of its elements. If the abstracted type were the implementation type of a structure you could operate on the structure without knowing its internal details.

Unfortunately TypeScript doesn't support existential types out of the box, but we can **encode** them using universally quantified types:

```typescript
type ArrayE = <R>(cont: <T>(ts: Array<T>) => R) => R
```

The meaning of the encoding is the following: something of type `∃T.Array<T>` is equivalent to an higher-order function that takes a continuation `cont` as argument, passes to it an array of `T` and returns the result of the continuation. The continuation represents the `Array<T>`'s client, which cannot assume anything about the internal content of the array, but can still operate on it and return whichever result `R` it wants, as long as it doesn't depend on `T`.

Let's see a simple example of `ArrayE` in action:

```typescript
function doLogUnshiftPop(arrayE: ArrayE) {
  arrayE(ts => {
    // ts has type Array<T> here
    const el = ts.pop()
    if(el) ts.unshift(el)
    console.log({ ts })
  })
}
```

The function `doLogUnshiftPop` takes an `ArrayE` and set the continuation to pop an element from the array, unshift it back and then log the array. The client of the `ArrayE` doesn't know the type of the array's elements, but can still operate on it with some limitations. They cannot push elements of a whatever type into the array because the array has type `Array<T>`, not `Array<unknown>`.

## Parsing raw data

Let's say we got some raw data from somewhere and we want to parse it. In particular, we want to parse an array of unknown entities and we want to be sure they all are of the same type:

```typescript
function parseRawArray<T>(xs: unknown[]): Array<T> {
  // does same-type checks on xs and returns what?
}
```

A problem of the above function is that there exists only one inhabitant of the `∀T.Array<T>` type, which is the empty tuple. We cannot craft an alternative value of type `Array<T>` for every possible `T` out there starting from an array of unknowns. Another problem is that the client of `parseRawArray` shouldn't be able to set the type `T` of the array's elements. Without making further assumptions they don't know the actual type of the raw data. The compiler doesn't know it either because it's something that can only be known at runtime, so we need to find a way to abstract over it.

We can use existential types to solve this problem:

```typescript
function parseRawArrayE(xs: unknown[]): ArrayE /* ∃T.Array<T> */ {
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

We solved the problem by returning an `ArrayE` instead of an `Array<T>`, because now the type variable `T` is not free for the client anymore, but bound by the existential quantifier. If the parsing is successful, we can say the array contains elements all of the same type `T`, for some `T` that exists but is unknown. Actually `∃T.Array<T>` doesn't exclude the possibility of `T` being an union type or a supertype, even if it's not the case here, but it's a good trade-off for this simple example.

The client of `parseRawArrayE` can operate on the array under the constraint that all its elements have the same parametric type. While managing an `Array<unknown>` would have been more error-prone, because that type lets the client assume the array could contain elements of whatever types it wants, the existential type provides a safer way to handle the parsed data and preserve its integrity.

[Play with existential types in the playground.](https://www.typescriptlang.org/play/?target=7&jsx=0&install-plugin=playground-ts-scanner#code/PTAEBcE8AcFNQIICckENIFFQF5SGAiAFQDpEV0AeAgPgCgo5S1MdRyAlKgCgGMB7AO3AAuVtU7gAziORNKVAJQ4qoNouzK2NGiFABXcAEsANgaigAZrv7dDAiL1DcAFrG4BrUAfMQA7g4BSAMqgvABGAFaukqBOqABu8OAuoBKoALaJMLA0lta2-J4SAPIRGACOuqhGBLycEry6SNywImGRNgA0oAAmsBLCIRFRigDeNKCe3pwl7eBEAOaw4AAKSLzg61lF5nUNTbCKAITYuDNRC0ur65tw25y9-fKj4xOgSEuNBeZVErAA3C8AL5aCY6RbgUBVIygTi8Hz8RTQNZwJBmfjpPqQ-jdFKQNKhXhGCQhbwEpKDWYSF58fj9FJ7ZpXaDE3BsWDmIznOH8ADSsEgEl2jWa8mpAjpDxWyJZKnZnJsRG5fIF9z64FFLx0zlcHi8oDJTgpUWJsQSEGSqQyoH4unxsCQJNASN4KMMfReeqF+yZEiInP483Jx1wkp9ftgAaSz1ebw+SC+P3+QJBoC1bh1k0hRmhztdBkxqGx5tgBgdD24SAM0A2SGJqHexZSGJe5l4Ds4nIhucd9WFsB90deNLpvf2ABE+twWGcFeCivCmfaoBOJBWqzWvc0urn5ACY8OIZKV1PTkNZ0t5-xF6jIMfK9W26r+tvkbuU6CwEkDMTu9-QGlvwkAwA08ApJS6ep6T7Qoei8cx7QjCEkkLTxwBeCYvE4Q4j0nQcY3ecBPgsRN0NAYFSMw0jXnoWBeG8UdmmPQ4iDiKpdHgE5cAAIjaKIuNAAAyASqImGi6J6NVjxYtiOJOUAeLPcB+KEkSoPHSdmNYox2NAYNrV0bNBOEmNXhw1dpO0+A9JtQyVJM3TvxmcpKmqWoGNgJiLPYrozO4LyDlIvDXgIojviJbIY3ImNKPsiAsnE9zPK0nTOPk3IbAMARlOM+yxO8Xz-JwOSuPS-JstUrUXHcLFICdZEl3zYlxNKzLaREw5HNKCoqhqTcPI0-yfMkyd-NFGMgomEL42I8LSKi14dCqd5UG6WrtXcWAcT1JJ+X1dZDXreAWvFEIHV4mwqRjHR9vtHxv0SFxarSXQ6VNB74EteAkQMADDDNGjQAonY8rUxiBuSqy5JB3zNJksaTLGeypoTWbIvfTNOFU0H+tXZiaXMAx5kaVBQk5XS5IK-HCeJ0n4AAHzprHEoGiNbXtEmyb0grWYyNBadABmmYZHHuGYnxK3ADnIZDYbzPF0wpYFxnYtTMBwheiF1t1bwfBcApUFAcFwHtGFfnAY2kEUP87HcrGdFMGC7ElexeC6QscTiAxmgSWtUCxvrPPBIrcCsXoCf4Tajjkp9wCkoPUtD9lgMjpX-eZ3GiDN4O9GxJOI+6KPcBjqSs4T3Pw8jwLQERkzkZm3491eYEJmbwGP2xn0sRxUNpRieJ3qbK1-UDJwOk1MBIJ7l1iW4QsAHIITe-82y++rUUalM6-AJB2IBcidGgetfixSEyFq93HCqtxiT1UxiVgTkMkEOsG3EnbB8yOAcisDK7EP2tYBsFQD4GQ6BOAAA8pA5zcPwbkABtAAuvIaQZ8sA10wpA8MkYnDPFIgeewbIBigOYLgGkEJ1COAEOACBEh4YTCBjQogsAfaQAgUoUA4Ds42SME8auIlKoZlbA6b6v0DBmm4aACGl1a5xgKBsQhc1SKkR0IhSsfQ55xTgHRaREx8HgEgSwTBaRUDQDYRQkG4CNTRR2CJfRvpmH2lYfo9hzi9IKVmNlCAnC3HHX4FxOhoAJqq0voItsdUfqmDEfAWB-AAC0EipEiXwQTWs4AAD6zjcAWIkHAgADAgkSmE7FMJYeITh5jylyRSf0DJligmTVkQQpYIlW4t1AA-Y+NcrpgC1hYMJ51ogX18To14MVYqYPeN0XQzROCcGgOAro3BLHsPmUZQoTluquTmZw1ATVFKLJ2Xs2YigAD8jhOEiG4QEiY9TYyEWmvI5p9lWlkXRkkNYPhrSwE+RgFAj4SoNCLN0OCCFBDtMEGoiQ-igTtPCnw-CjSyHsLIZwRB8NgTkW0GAF6qBFhaHwf-X43RiFYFwISwBwDiGopeCMa0GIRBcQQNiZaXE3aLBEAAJgAIxkTHhMWl6IMgMqZeiVlkJ2WgA5QAZl5TSulQr5IABlpmoDFbilooApUAFZZVIPxeKLsR9Noko5SwclQCQFn1RVyroHKuhSr1d-PIrUei8EVbweYABVWkTgvArBdJwesTAMAoODYOIN6AMDiBZMoLpwSJgAD0Tl4INbClgkgiDQADQEzCD9FAZqsBIX15hqF5vRsOQksA-Qes4LS6IgJ0WinIt0N1HrvVFr9csAN5LiWoNFC291XqfWdu7Ua3twaOWiiAA)
