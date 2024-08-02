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

To do something like this, the compiler was able to answer the following question: for which type `T` do we have that `Foo<T>` is `{ a: { value: string }, b: { value: number } }`? We can mentally reverse the action of the mapped type: `a: { value: string }` implies that `T[K]` must be `string` when `K` is `"a"`, similarly `b: { value: number }` implies that `T[K]` must be `number` when `K` is `"b"`. The fact that TypeScript is able to achieve this too is simply amazing!

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

1. If not already known, TypeScript infers the type of the argument `x` passed to the function `foo`.

2. TypeScript does its best to invert the action of mapped type `Foo` on the type of the argument `x`, to determine what `T` is. In particular, each key of `T` will be inferred separately, independently from the others, by exploiting the template `F<T[K]>`. If the inference of a single key fails, the resulting type for that key will be `unknown`, while the other keys will not be affected by the failure. Be aware of the fact that, as for now, [TypeScript does not resort to the constraint type before falling back to `unknown`](https://github.com/microsoft/TypeScript/issues/56241) in such cases.

3. TypeScript checks that the just inferred type `T` is indeed assignable to its upper bound. If that is not the case, `T` will become the upper bound itself, discarding whatever was inferred before. This is the default behaviour of the `getInferredType` internal function and it applies to any function call, but this could lead to some unexpected results in this situation.

4. TypeScript now applies the mapped type `MappedType` on `T`, to determine the type of the formal parameter `mt`.

5. TypeScript checks that the type of the argument `x` is assignable to the type of the formal parameter `mt`.
