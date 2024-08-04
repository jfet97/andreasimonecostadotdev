+++
author = "Andrea Simone Costa"
title = "What the heck are reverse mapped types?"
date = "2024-08-02"
description = "Let's try to understand what the TypeScript guys mean when they talk about reverse mapped types."
categories = ["typescript"]
series = ["TypeScript"]
published = true
tags = [
    "mapped type",
    "reverse"
]
featuredImage = "/images/reverse_mapped/copertina.jpeg"
images = ["/images/reverse_mapped/copertina.jpeg"]
+++

## Introduction

Reverse mapped types are a powerful yet little-known feature of TypeScript that allow us to set interesting constraints on the values of a type. They are mainly a mechanism for inferring a function's type parameters from values; however, the same inference steps can be performed at the type level using the `infer` keyword. The purpose of this article is to serve as a comprehensive guide to reverse mapped types, explaining what they are and how they can be used. Various references to the compiler source code will be made in order to provide a deeper understanding of the topic.

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

As I mentioned before [this works at the type level too](https://www.typescriptlang.org/play/?ts=5.5.4#code/C4TwDgpgBAYg9nAPAFQHxQLxQN4CgoFQDaA0lAJYB2UA1hCHAGZTIC6AXDlAG4CGANgFcInZKVZQAvrmm5QkKACUI3CACcAzhHhI0mFlAgAPYBEoATDbASIqjdVACq6APxOonSivW454aKYawPrKqpraNthQvJxRfEIiUEFqVADmUgA0UABGsTwCwp6CALbZDpJSqLgA9NWEAHouQA), but the focus of this article is on the function's type parameters inference. TypeScript is able to do this inversion for us in some cases, and in this article we will explore the potential, and the limits, of this feature.

&nbsp;

## How does it work?

The outline of the situation is more or less the following:

```ts
type MappedType<T> = {
    [K in keyof T]: F<T[K]>
}


declare function foo<T extends C>(mt: MappedType<T>): ...
foo(x) // T inferred from x
```

where `F<T[K]>` means that `T[K]` is used in some way there. This is very important because it's gonna be used as inference site for the types of the keys while the compiler is trying to invert the action of the mapped type.

In broad terms, what happens is the following:

1. If not already known, TypeScript infers the type of the argument `x` passed to the function `foo`. This type is internally named as __source__.

2. TypeScript does its best to invert the action of mapped type `MappedType` starting from the source type to determine what `T` is. In particular, each key of `T` will be inferred separately, independently from the others, by exploiting the __template__ `F<T[K]>`. It's like having defined a variable length list of type parameters, one for each key of `T`. If the inference of a single key fails, the resulting type for that key will be `unknown`, while the other keys will not be affected by the failure. Be aware of the fact that, as for now, [TypeScript does not resort to the constraint type before falling back to `unknown`](https://github.com/microsoft/TypeScript/issues/56241) in such cases.

3. TypeScript checks that the just inferred type `T` is indeed assignable to its constraint `C`. If that is not the case, `T` will become the constraint itself, discarding whatever was inferred before. This is the default behaviour of the `getInferredType` internal function and it applies to any function call, but it could lead to some unexpected results in this situation.

4. TypeScript now applies the mapped type `MappedType` to whatever `T` has become at this point, to determine the type of the formal parameter `mt`.

5. TypeScript checks if the type of the argument `x` is assignable to the type of the formal parameter `mt`, erroring if that is not the case.

&nbsp;

## The source's requirements

Which are the requirements that the source type must satisfy in order to be reverse mappable? A couple of comments in the TypeScript source code give us the answer:

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

&nbsp;

## The mapped type's requirements

What about the requirements that the mapped type must satisfy? As for now, the `inferFromObjectTypes` internal function set an interesting one:

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
2. mapped types like `{ [P in K]: X }`, where the __constraint__ `K` is a type parameter
3. mapped types like `{ [P in A | B]: X }` where the constraint is an union, useful when the union contains a constraint similar to the one in `1` or `2`
4. mapped types like `{ [P in A & B]: X }` where the costraint is an intersection, useful when the intersection contains a constraint similar to the one in `1` or `2`

We will explore how the union constraint ensures the presence of certain properties, while the intersection constraint prevents the presence of additional properties.

Let's dig into each of these cases.

### Homomorphic mapped types

I wrote about homomorphic mapped types in a [previous article](../../posts/what-the-heck-is-a-homomorphic-mapped-type/), so take a look if you're unfamiliar with them.

The source code says:

> We're inferring from some source type `S` to a homomorphic mapped type `{ [P in keyof T]: X }`, where `T` is a type variable. Use `inferTypeForHomomorphicMappedType` to infer a suitable source type and then make a secondary inference from that type to `T`.

The reason behind the double inference pass is related to the priority of some inferences, but I have to admit this is a bit obscure to me. Feel free to take a look at the source code if you're interested in this and let me know what you find out! The main point, however, is that TypeScript should be able to reverse them, as long as there is no `as` clause. Pun not intended.

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

[Playground](https://www.typescriptlang.org/play/?exactOptionalPropertyTypes=true&ts=5.5.4#code/C4TwDgpgBAsghmSATAKuCAeAClCAPYCAOyQGcosAnAe0ktAGkIQA+KAXigG8BYAKCiCoAbQZQAlkQoBdAFxQiAVwC2AIwiV+AX378kEAMYAbOJWgAzRUQPBx1KYtIQYKbLgLEyFGnUbMWABTKwPLwiBCo6NgsAJTyWLp8BvakwFBm5JyOzigBvAJQcPIALABMADT8gqryAIylAMzF2jGJghn8APSdUAB6APxAA).

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

We have that `T` gets inferred as `{ a: number, b: boolean }` and `P` gets inferred as `'a' | 'b'`. As before, `P` is inferred from `keyof { a: number, b: boolean }`, that is `'a' | 'b'`. But what about `T`? Let's again refer to the source code:

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

declare function useMT<P extends PropertyKey, X>(mt: MappedType<P, X>): [P, X]

useMT({
  a: ["a", "a-prop"],
  b: false
})
```

[Playground](https://www.typescriptlang.org/play/?exactOptionalPropertyTypes=true&ts=5.5.4#code/C4TwDgpgBAsghmSATAKuCAeAClCAPYCAOyQGcosAnAe0ktAGkIQAaKADQD4oBeKAbwCwAKChioAbQZQAlkQoBdAFwcRAXxEikEAMYAbOJWgAzAK5EdwGdXmnSEGCmy4CxMhRp1GzNlwAUALbAKvCIEKjo2L6cAJQqEli+CprCOjakwFBG5Hx2Dih+QqJQcPEARHBlbBUAtGCeZQosImIARirGcHr26jEpYtkiAPRDUAB6APxAA).

We have that `P` gets inferred as `'a' | 'b'` as before, wherease `X` gets inferred as `boolean | string[]`.
  
### Union as constraint

Let's consider the following mapped type:

```ts
type MappedType<T> = {
  [K in keyof T | "mustBePresent"]: {
    // cannot put just T[K] here, because K cannot be used to index T
    // i.e. there is no guarantee here that "mustBePresent" is a key of T
    value: K extends "mustBePresent" ? unknown : K extends keyof T ? T[K] : never;
  };
};

declare function unmap<T>(t: MappedType<T>): T;

const res = unmap({
  a: { value: "andrea" },
  b: { value: "simone" },
  c: { value: "costa" },
  mustBePresent: { value: 123 },
});
```

[Playground](https://www.typescriptlang.org/play/?exactOptionalPropertyTypes=true&ts=5.5.4#code/C4TwDgpgBAsghmSATAKuCAeFA+KBeKAbwFgAoKKAbQGkoBLAOygGsIQB7AMyhSgB8oAIgC2AVwDOwAEIQACgCcI4iA2CCAugC4iZChQD0+qAGM4DBu2BQwoqwCsJVlDXVQAFhEUAaKACMIphLQtKbmln7QQUhQwOz0DEgQAB48unqG9AB0EJkxHor04lAWUADmonDyZsAQ0PnQwG5wViKOMgpKKmqFUHAsbFBcqeR6AG5wADaiENq0yTUJRa2S7YrKqoJQAPxQogzMFgDuTLNQ8ypIRawc3Lw7ztSu2gwQo54A3GkAvp+kP2RkRLGCaVaCcPbGYB0dhMPbCBBYbAACmA2ngiAgqHQiIAlNoUL8yMYYZIoGt8LsGPCwEiSCM4NpCFBxlMZkIzEhFHBNl8vGlfIzmZNptpBOI6MIYRAeXyRsZBSyRUJiZJuVBeWkxCs5GsugrhWyAIwAJgAzOrZV8cYSRmtfhkAHpbIA).

We have that `T` gets inferred as `{ a: string, c: string, c: string, mustBePresent: number }`. In few words, TypeScript loops through the union's entries, finds the `keyof T` and reverses the whole source type as we saw before.

This example shows us that reverse mapped types could be useful not only because of their reversing capabilities, but also because they can enforce some properties in the source type. Had we omitted the `'mustBePresent'` field, TypeScript would have inferred `T` as `{ a: string, b: string, c: string }`, but when `MappedType` is applied to it to get the type of the formal parameter `t`, the resulting type would have been `{ a: { value: string }, c: { value: string }, x: { value: string }, mustBePresent: { value: unknown } }`. This would have caused an error, because the source type would not have been assignable to the formal parameter type: _Property 'mustBePresent' is missing in type '{ a: { value: string; }; b: { value: string; }; c: { value: string; }; }' but required in type 'MappedType<{ a: string; b: string; c: string; }>'_.

### Intersection as constraint

From the version `5.4` of the compiler, TypeScript is able to reverse mapped types [with an intersection constraint](https://github.com/microsoft/TypeScript/pull/55811). This is a very interesting feature, because it allows us to prevents the presence of additional properties while inferring a type. In other words, this provides us with the ability to enable EPC (Excess Property Checking) on type parameters inference sites.

Let's consider the following example:

```ts
interface Foo {
  bar: number;
  baz: string;
  record: Record<any, any>;
}

type MappedType<T> = {
  // the intersection constraint on K is keyof T & keyof Foo
  [K in keyof T & keyof Foo]: T[K]
}

declare function useFoo<T extends Foo>(foo: MappedType<T> ): T

useFoo({ 
  bar: 1,
  baz: 'a',
  record: { a: 1, b: 2 },
  extra: 123, // <-- EPC error
})
```

[Playground](https://www.typescriptlang.org/play/?exactOptionalPropertyTypes=true&ts=5.5.4#code/JYOwLgpgTgZghgYwgAgGIHt3IN4FgBQyyARnFAFzIgCuAtsdANwFGkBelAzmFKAObNCyKBATooAE0oAlUeIkAeOCACeAGmTKVAPkEBfAgTAqADigCycE2YkAVUxAW3tyALw4WyAPRfkYABYooJBQnKJgwOggyGIg3FBwwchRyADSyMCcyADWECroMMi2yABkOXkFaJieANrpoOX5hcVluU1V6AC6lLZ1nQQG+AQSogA2ZCgw1CAIESnUYRjoTsgQAB6QIBJZS9oAFDCYlJbWEHYOTi4AlD2G+LHcwhBZ7gsQS3vYyJ6kFMgAjGofnAOMgAORwMFAoQiMSSShfOCUQEkSgAJmQemhRHWPCRALRAGYND5kAoALTk5AAUQACgBhVZQKDiAZXO5EEScQSkgB6AH4gA).

TypeScript loops through the intersection's entries, finds the `keyof T` and reverses the whole source type as we saw before. The intersection constraint ensures that the source type has only the properties that are present in `Foo`, and this is why the presence of the `'extra'` property causes an excess property error. It's worth noting that the `'extra'` property is stripped away from the inferred `T` because it wouldn't survive the action of the mapped type anyway.

In this way you get both inference and EPC check!

&nbsp;

## Arrays and tuples

We said that reverse mapping gets applied to the type of each property of an object type independently from the others. What if we have an array or a tuple? A comment inside the `createReverseMappedType` internal function says that:

> For arrays and tuples we infer new arrays and tuples where the reverse mapping has been applied to the element type(s).

One example to rule them all:

```ts
// just removes the 'on' prefix from the event names
type PossibleEventType<K> = K extends `on${infer Type}` ? Type : never;

type TypeListener<T extends ReadonlyArray<string>> = {
  [I in keyof T]: {
    type: T[I];
    listener: (ev: T[I]) => void;
  };
};

declare function bindAll<
  T extends HTMLElement,
  Types extends ReadonlyArray<PossibleEventType<keyof T>>
>(target: T, listeners: TypeListener<Types>): void;

// {} as a fake HTMLInputElement
bindAll({} as HTMLInputElement, [
  {
    type: "blur",
    listener: (ev) => {
            // ^? ev: "blur"
    }
  },
  {
    type: "click",
    listener: (ev) => {
            // ^? ev: "click"
    }
  },
]);
```

[Playground](https://www.typescriptlang.org/play/?exactOptionalPropertyTypes=true&ts=5.5.4#code/C4TwDgpgBACg9gZwQSwEYBsIFEBuEB2wAKuBADwDSAfFALxQVQQAewBAJglAAZz4AkAb2T4AZhABOUEpAC+3KAH5ppKAC4o+CHgkBuALAAoI6EgrIAGWQI2WiWSJNWHLgCUIAQ3Z90IAIISEh4gZDYSIgDmVDT0gkZQUADaAJJQIlAA1hAgcKLSALoacYYJCaYQGkQp+QYlpejWtpIaABTaldUAlHQ0OHDI7LUJsrUjRkbsEADG6B4S0KIArvhTwMh8UKgi7H7o6GTx0k62nFAAEkQAshZYmAC2BMAANIcyEFwsJ26e3vi+AUEQvAkGhMLhHm8yFkcnkiNEjFQWsA5hEIMBKk8oA0bARJAhKqQrDi7A5SAgqJ0NH0BrUjAB6OlQQSyKBTOAPKCiETAOBMPCEOBGLb4HZ7FrMqAeLgXa7JfBgRbAW4QB6ETGJQ7FUpQcoaABEGEWEj1LzqCWxTQkrW03VoNC12sdCQZUAAeopDsNDrJTQkHWVSPqZsgphkTZ6sY1cVaoG0cLb7RGnc7Ge6I7Jvab8p1dEA).

Here we see that TypeScript is able to properly infer `Types` as the tuple type `["blur", "click"]` by reverting the type of the input array with respect to the `TypeListener` mapped type. TypeScript will then apply the `TypeListener` mapped type to it to determine the type of the formal parameter `listeners`, and that provides the partially inferable source type with the context sensitive information it needs to get the type of the `ev` parameters in the callbacks.

The inferred `Types` must satisfy its constraint too, i.e. it must be an array or a tuple of strings containing some event names belonging to the input `HTMLElement`, without the `'on'` prefix.

&nbsp;

## Enforcing recursive constraints on the source type

We saw that reverse mapped types can be used to enforce some constraints on the source type. The following example, borrowed from [Mateusz Burzyński](https://x.com/AndaristRake), builds on this concept and shows that recursion may be allowed:

```ts
type StateConfig<T> = {
  initial?: keyof T;
  states?: {
    // here is the mapped type
    [K in keyof T]: StateConfig<T[K]> & {
      on?: Record<string, keyof T>;
    };
  };
};

declare function createMachine<T>(config: StateConfig<T>): T;

createMachine({
  initial: "a",
  states: {
    // try to get rid of "a"
    a: {
      on: {
        // try to change "a" to something else
        NEXT: "a",
      },
    },
    b: {
      initial: "nested",
      on: {
        NEXT: "b",
      },
      states: {
        nested: {
          on: {
            TEST: "nested",
          },
        },
      },
    },
  },
});
```

[Playground](https://www.typescriptlang.org/play/?exactOptionalPropertyTypes=true&ts=5.5.4#code/C4TwDgpgBAysCGwIGED2A7AZgSwOYB4AVAPigF4oBvAWACgopt1tht4AbAfgC4oBrCCFSYohANx0GAZwRIpPKpIZQA2gGlG6foOGiAurziIUGHAULq9pAGSL6yhhgUAlCAGNUAJwAm+GZ6ZcABptIRESCXsGAF9ImMjYujpvd3Z4T2hMAFd0N1YMKDcM4wBZeDcACyYIImIACg8sPENZEybzYgBKXnEk2kaZKAypckLipDLK6rqaeyYWNnZeACJ4ZaClGWMpXlmHAHp9qGBPEGPUKFwIYCHsbyhdVeWlBnhdl+UMd6iHKEPj07nQoVeDoK5QJ5AqSoAC21yqYKgEHYUggHwcADkAKIADUIKzWGx+MSJDmipOUACNvr9NAsOCt0BAZBBvOt0Q90DTaVBsXiVpT2cSoOSOVs5NzaUyWd5JTyvnYeb9CFiYPiIdKkGyKUrRcKSRy9WSKXrop1IkphnR-gA9ThAA).

The inferred `T` type is a little bit ugly but it's correct: `{ a: unknown, b: { nested: unknown } }`. Why are there those `unknown`? When any of the sub-fields of an arbitrary nested `'states'` field does not contain a `StateConfig`, there will be no candidate for `T[K]` and so TypeScript will resort to `unknown` for that sub-field.

Which constraints are we enforcing on the source type? At any level, the `'initial'` field must be a key of the object present in the `'states'` field at the same level. Furthermore, we can jump from one state to another only if both are defined at the same level.

&nbsp;

## Further limitations

It follows a list of limitations, by no means complete, that you should be aware of when using reverse mapped types, which I'm not discussing in detail here:

* [https://github.com/microsoft/TypeScript/issues/48798](https://github.com/microsoft/TypeScript/issues/48798)
* [https://github.com/microsoft/TypeScript/issues/51612](https://github.com/microsoft/TypeScript/issues/51612)
* [https://github.com/microsoft/TypeScript/issues/56910](https://github.com/microsoft/TypeScript/issues/56910)

&nbsp;

## Conclusion

The very first time I've heard about reverse mapped types was on Xitter a couple of years ago, thanks to the already mentioned [Mateusz](https://x.com/AndaristRake), whom I thank for the countless insights he gave me on the topic. TypeScript has the bad habit of having a lot of super useful and super interesting but undocumented advanced features and this is one of them. It's not a coincidence that my primary reference for writing this article has been the compiler's source code itself.

The only other resource on the topic that I can suggest is a talk by Mateusz at TypeScript Congress 2023, titled [Infer multiple things at once with reverse mapped types](https://gitnation.com/contents/infer-multiple-things-at-once-with-reverse-mapped-types).

I want to thank [David Blass](https://x.com/ssalbdivad) too, who took the time to review the article and gave me some very useful feedback to clarify some points.

I hope that this article has been useful to you and that you have learned something new. If you have any questions or comments, feel free to reach out to me on [Xitter](https://x.com/jfet97).
