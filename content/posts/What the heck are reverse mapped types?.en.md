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

Reverse mapped types are a powerful yet little-known feature of TypeScript that allow us to set interesting constraints on the values of a type. The purpose of this article is to serve as a comprehensive guide to reverse mapped types, explaining what they are and how they can be used.

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

While the union constraint could be seen as a way to force the presence of some properties, the intersection one could be seen as a way to prevent the presence of extra properties.

```ts
```


  


// TODO
// createReverseMappedType tratta in modo particolare array e tuple