+++
author = "Andrea Simone Costa"
title = "What the heck are reverse mapped types?"
date = "2024-08-02"
description = "Let's try to understand what the TypeScript guys mean when they talk about reverse mapped types"
categories = ["typescript"]
series = ["TypeScript"]
published = false
tags = [
    "mapped type",
    "reverse"
]
featuredImage = "/images/reverse_mapped/copertina.jpeg"
images = ["/images/reverse_mapped/copertina.jpeg"]
+++

## Introduction

Reverse mapped types are a powerful yet little-known feature of TypeScript that allow us to set interesting constraints on the values of a type. The purpose of this article is to serve as a comprehensive guide to reverse mapped types, explaining what they are and how they can be used. Various references to the compiler source code will be made in order to provide a deeper understanding of the topic.

Let's take a simple generic function like the following:

```typescript
function foo<T>(a: ReadonlyArray<T>): ReadonlyArray<T> {
    return [...a]
}
```

We are not surprised that TypeScript can infer the type `T` of the array elements from the argument passed to the function:

```typescript
foo([1, 2, 3]); // T = number

foo(['a', 'b', 'c']); // T = string
```

But what if we had a mapped type in place of `ReadonlyArray<T>`? Would TypeScript still be able to infer the type `T`? This is what we are referring to when we talk about inverting a mapped type.

Let's kick things off with a simple example. Suppose we have the following mapped type:

```typescript
type Foo<T> = {
    [K in keyof T]: { value: T[K] }
}
```

Let's write a function that takes a `Foo<T>` and unwraps the `value` properties:

```typescript
function unwrap<T>(foo: Foo<T>): T {
    const result = {} as T
    for (const key in foo) {
        result[key] = foo[key].value
    }
    return result
}
```

What return type should we expect from the following call?

```typescript
unwrap({
    a: { value: "hi there" },
    b: { value: 42 }
})
```

Of course we expect `{ a: string, b: number }`, and that's exactly what we got. [TypeScript is able to infer the type `T` from the argument passed to the function](https://www.typescriptlang.org/play/?ts=5.5.4#code/C4TwDgpgBAYg9nAPAFQHxQLxQN4CgoFQDaA0lAJYB2UA1hCHAGZTIC6AXDlAG4CGANgFcInZKVZQAvrmm5GgygGNg5ONQUB3AE68wKVAApGCTvCRoAlKJz5CitQGdgULRAeD+zrNklReDllsCYy0oA3tKJ1p6CmpjOAsbQmSXNw9gIjoQCSx4zPpWADo+IQggqXLXYEEtald3TxlcXAio+swoTR0wAzxk3k5sHgFhTgAiAAtyKGAJiFcxqQAacoAjQeHSzgAWACYKyQtmgnrcAHozqAA9AH4gA), but that's not a given at all!

Why?

To do something like this, the compiler was able to answer the following question: for which type `T` do we have that `Foo<T>` is `{ a: { value: string }, b: { value: number } }`? We can mentally reverse the action of the mapped type: `a: { value: string }` implies that `T[K]` must be `string` when `K` is `'a'`, similarly `b: { value: number }` implies that `T[K]` must be `number` when `K` is `'b'`. The fact that TypeScript is able to achieve this too is simply amazing!

TypeScript is able to do this inversion for us in some cases, and in this article we will explore the potential, and the limits, of this feature.

## How does it work?

The outline of the situation is as follows:

```ts
type MappedType<T> = {
    [K in keyof T]: F<T[K]>
}


declare function foo<T>(mt: MappedType<T>): ...
foo(x) // T inferred from x
```

where `F<T[K]>` means that `T[K]` is used in some way there. This is very important because it's gonna be used as inference site for the types of the keys while the compiler is trying to invert the action of the mapped type.

In broad terms, what happens is the following:

1. If not already known, TypeScript infers the type of the argument `x` passed to the function `foo`. This type is internally named as __source__.

2. TypeScript does its best to invert the action of mapped type `MappedType` starting from the source type to determine what `T` is. In particular, each key of `T` will be inferred separately, independently from the others, by exploiting the __template__ `F<T[K]>`. If the inference of a single key fails, the resulting type for that key will be `unknown`, while the other keys will not be affected by the failure. Be aware of the fact that, as for now, [TypeScript does not resort to the constraint type before falling back to `unknown`](https://github.com/microsoft/TypeScript/issues/56241) in such cases.

3. TypeScript checks that the just inferred type `T` is indeed assignable to its upper bound. If that is not the case, `T` will become the upper bound itself, discarding whatever was inferred before. This is the default behaviour of the `getInferredType` internal function and it applies to any function call, but this could lead to some unexpected results in this situation.

4. TypeScript now applies the mapped type `MappedType` to whatever `T` has become at this point, to determine the type of the formal parameter `mt`.

5. TypeScript checks if the type of the argument `x` is assignable to the type of the formal parameter `mt`, erroring if that is not the case.

## The source's constraints

Which are the constraints that the source type must satisfy in order to be reverse mappable? A couple of comments in the TypeScript source code give us the answer:

> We consider a source type reverse mappable if it has a string index signature or if it has one or more properties and is of a __partially inferable type__.
>
> We consider a type to be __partially inferable__ if it isn't marked non-inferable or if it is an object literal type with at least one property of an inferable type. For example, an object literal `{ a: 123, b: x => true }` is marked non-inferable because it contains a context sensitive arrow function, but is considered partially inferable because property `'a'` has an inferable type.

The fact that partially inferable types are allowed is very important, because this means that reverse mapped types are able to provide context sensitive information back to the source type:

```ts
type ContextSensitive<T> = {
    [K in keyof T]: { v: T[K], f: (_: T[K]) => void }
}

declare function useCS<T>(cs: ContextSensitive<T>): void


useCS({
  num: { v: 42, f: (n) => n * 10 },
                 // ^? n: number
  str: { v: "hi there", f: (s) => s.repeat(3) }
                         // ^? s: string
})
```

[Playground](https://www.typescriptlang.org/play/?ts=5.5.4&ssl=13&ssc=3&pln=1&pc=1#code/C4TwDgpgBAwg9gO2BAHsAyhBBnAlsXANwgB4AVAPigF4oBvAKCmagG0BpKXBKAawhBwAZlDIBdAFz0ohKWQ5iANFCFSAFAH05CgJQ0qhOLgAmUAL4MLDYxADGAGwCGAJ2hCArglsFEUd9ggYdHIKNVtsKXgkVAwsPAJiEJ0pQxMGdP9A9DVGZgR3AFspOhkpABYAJmVVKDUEPWoqHgAqKABGAAZzRSYWPv6+gHpBqAA9AH5e7GBnYtKoACIAC1woYCWIVwXq9WwGqmwAOldIR2A1AGY9CwHbu6GRicsdIA).

In the example above we use `T[K]` both as type for the property `'v'` and as type for the parameter of the function `'f'`. TypeScript is able to infer that `T` is `{ num: number, str: string }` from the partially inferable argument passed to `useCS` by using the type of the property `'v'` only. At the end of the whole process, some context sensitive information is provided back from `ContextSensitive<{ num: number, str: string }>` to the source: the type of the parameters of the functions `'f'`.

## The mapped type's constraints

What about the constraints that the mapped type must satisfy? As for now, the `inferFromObjectTypes` internal function set an interesting constraint:

```ts
if (getObjectFlags(target) & ObjectFlags.Mapped && !(target as MappedType).declaration.nameType) {
    const constraintType = getConstraintTypeFromMappedType(target as MappedType);
    if (inferToMappedType(source, target as MappedType, constraintType)) {
        return;
    }
}
```

The point is that there should not be any `nameType`, and that means no `as` clause in the mapped type. This is a limitation that [could be removed in the future](https://github.com/microsoft/TypeScript/pull/52972), but for now it is what it is.

Let's dig into the `inferToMappedType` internal function now. From the code we see that TypeScript is able to reverse four kinds of mapped types:

1. homomorphic mapped types like `{ [P in keyof T]: X }`
2. mapped types like `{ [P in K]: X }`, where `K` is a type parameter
3. a mapped type with an union constraint, as long as the union contains a constraint similar to `1` or `2`
4. a mapped type with an intersection constraint, as long as the intersection contains a constraint similar to `1` or `2`

We will explore how the union constraint ensures the presence of certain properties, while the intersection constraint prevents the presence of additional properties.

Let's dig into each of these cases.

### Homomorphic mapped types

I wrote about homomorphic mapped types in a [previous article](../../posts/what-the-heck-is-a-homomorphic-mapped-type/), so take a look if you're unfamiliar with them. The point is that TypeScript is able to reverse them, as long as there is no `as` clause. Pun not intended.

The source code says:

> We're inferring from some source type `S` to a homomorphic mapped type `{ [P in keyof T]: X }`, where `T` is a type variable. Use `inferTypeForHomomorphicMappedType` to infer a suitable source type and then make a secondary inference from that type to `T`.

The reason behind the double inference pass is related to the priority of some inferences, but I have to admit this is a bit obscure to me. Feel free to take a look at the source code if you're interested in this and let me know what you find out!

### Mapped type with a type parameter as constraint

This is a very interesting case. Suppose we have the following mapped type:

```ts
type MappedType<P extends PropertyKey> = {
    [K in P]: number
}

declare function useMT<P extends PropertyKey>(mt: MappedType<P>): P

foo({
  a: 42,
  b: 1234
})
```

[Playground](https://www.typescriptlang.org/play/?exactOptionalPropertyTypes=true&ts=5.5.4#code/C4TwDgpgBAsghmSATAKuCAeAClCAPYCAOyQGcosAnAe0ktAGkIQA+KAXigG8BYAKCiCoAbQZQAlkQoBdAFxQiAVwC2AIwiV+AX378kEAMYAbOJWgAzRUQPBx1KYtIQYKbLgLEyFGnUbMWABTKwPLwiBCo6NgsAJTyWLp8js4oAbwCUHDyACwATAA0-IKq8gCMuQDM2doxQA).

We have that `P` gets successfully inferred as `'a' | 'b'`. How? The source code answers this question:

> We're inferring from some source type `S` to a mapped type `{ [P in K]: X }`, where `K` is a type parameter. First infer from `keyof S` to `K`.

That's exactly what TypeScript did: it inferred from `keyof { a: number, b: number }`, that is `'a' | 'b'`, to `P`.

But TypeScript's capabilities don't stop here. Suppose we have the following mapped type that resembles the `Pick` one:

```ts
// a custom version of the built-in Pick type
type MyPick<T, P extends keyof T> = {
  [K in P]: { value: T[K] };
}

// a function that takes a MyPick<T, P> and returns a Pick<T, SP>
// where SP is a subset of P
declare function unpick<
  T,
  P extends keyof T,
  SP extends P,
>(t: MyPick<T, P>, keys: SP[]): Pick<T, SP>;

unpick({
  a: { value: 42 },
  b: { value: false },
}, ["a"]);
```

[Playground](https://www.typescriptlang.org/play/?exactOptionalPropertyTypes=true&ts=5.5.4#code/C4TwDgpgBAsiAKBLAxgawDwBUA0V5QgA9gIA7AEwGcpUIQB7AMykwD4oBeKAbwFgAoKFADaAaSiJSeALoAuHlABuAQwA2AVwjzMY6VAC+AbgH6BA8hGSrlAJ2iN1pZMET0pjsCgwChOH3gJiMioaOiYWbH8AZXwiEgpqeEj+VgAKYHk4JDQsXHhWXFoQSnkY4WkASnlsjBwoGNZjfgFkN0pgKDtqLg8vVL5BKGV5biU1TXkAFgAmA2ShACMRsY0tKEY1Smh9ZJ2RACJlfcqm-y6mgHoLqAA9AH4gA).

We have that `T` gets inferred as `{ a: number, b: boolean }` and `P` as `'a' | 'b'`. As before, `P` is inferred from `keyof { a: number, b: boolean }`, that is `'a' | 'b'`. But what about `T`? Let's again refer to the source code:

> If `K` (the one in `{ [P in K]: X }`) is constrained to a type `C`, also infer to `C`. Thus, for a mapped type `{ [P in K]: X }`, where `K` extends `keyof T`, we make the same inferences as for a homomorphic mapped type `{ [P in keyof T]: X }`.

We see indeed that `inferToMappedType` is called recursively in this case:

```ts
const extendedConstraint = getConstraintOfType(constraintType);
if (extendedConstraint && inferToMappedType(source, target, extendedConstraint)) {
    return true;
}
```

If no inferences can be made to `K`'s constraint, TypeScript will infer from a union of the property types in the source to the template type `X`. The following example shows this:

```ts
type MappedType<P extends PropertyKey, X> = {
    [K in P]: X
}

declare function useMT<P extends PropertyKey, X>(mt: MappedType<P, X>): P

useMT({
  a: ["a", "a-prop"],
  b: false
})
```

[Playground](https://www.typescriptlang.org/play/?exactOptionalPropertyTypes=true&ts=5.5.4&ssl=10&ssc=3&pln=1&pc=1#code/C4TwDgpgBAsghmSATAKuCAeAClCAPYCAOyQGcosAnAe0ktAGkIQAaKADQD4oBeKAbwCwAKChioAbQZQAlkQoBdAFwcRAXxEikEAMYAbOJWgAzAK5EdwGdXmnSEGCmy4CxMhRp1GzNlwAUALbAKvCIEKjo2L6cAJQqWJrCdg4ofkKiUHAqEgBEcDlseQC0YJ45CiwiYgBGKsZwevbqMUA).

We have that `P` gets inferred as `'a' | 'b'` as before, wherease `X` gets inferred as `[string, string] | boolean`.
  


// TODO
// createReverseMappedType tratta in modo particolare array e tuple