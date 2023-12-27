+++
author = "Andrea Simone Costa"
title = "What the heck is a homomorphic mapped type?"
date = "2023-12-27"
description = "Let's try to understand what the TypeScript guys mean when they talk about homomorphic mapped type"
categories = ["typescript"]
series = ["TypeScript"]
published = true
tags = [
    "mapped type",
    "homomorphic"
]
featuredImage = "/images/mapped_type_omomorfi/the-what.jpg"
images = ["/images/mapped_type_omomorfi/the-what.jpg"]
+++

## Introduction

I remember back in the day when I stumbled upon the term _homomorphic_ for the first time in the good ol' TypeScript handbook. Honestly, the handbook's explanation was a bit fuzzy to me.

After listing a couple of example mapped types:

```ts
type Nullable<T> = { [P in keyof T]: T[P] | null };
type Partial<T> = { [P in keyof T]?: T[P] };
```

The handbook continued by saying:

> In these examples, the properties list is `keyof T` and the resulting type is some variant of `T[P]`. This is a good template for any general use of mapped types. That’s because this kind of transformation is __homomorphic__, which means that the mapping applies only to properties of `T` and no others.

Immediately afterward, it claimed that even `Pick<T, K extends keyof T> = { [P in K]: T[P]; }` is homomorphic, while `Record` is not:

> `Readonly`, `Partial` and `Pick` are homomorphic whereas `Record` is not. One clue that `Record` is not homomorphic is that it doesn’t take an input type to copy properties from. Non-homomorphic types are essentially creating new properties, [...].

The term _homomorphic_ is a bit of a stretch from its math roots, but it's basically saying that the mapped type keeps the original type's structure intact. Looking back, after getting cozy with the type system, the handbook's explanation makes more sense now. But hey, it is not an updated definition. In fact, there is no updated definition. The new handbook doesn't even mention the term _homomorphic_, but it does appear in the source code.

I got tired of not understanding, so I opened up the compiler and tried to figure out once and for all what the heck a homomorphic mapped type is.

## Into the compiler

### getHomomorphicTypeVariable

Here's the function that helps us answer the question:

```ts
function getHomomorphicTypeVariable(type: MappedType) {
  const constraintType = getConstraintTypeFromMappedType(type);
  if (constraintType.flags & TypeFlags.Index) {
    const typeVariable = getActualTypeVariable((constraintType as IndexType).type);
    if (typeVariable.flags & TypeFlags.TypeParameter) {
      return typeVariable as TypeParameter;
    }
  }
  return undefined;
}
```

A mapped type `{ [P in C]: ... }` is homomorphic if its constraint `C` is just a `keyof T`, where `T` must be a type variable. This is indicated by the `TypeFlags.Index` and `TypeFlags.TypeParameter` flags, respectively. Where does the type variable come from? It could be declared as input or inferred using the `infer` keyword. So, the examples from the old handbook are all good, except for `Pick`, which it seems TypeScript no longer considers homomorphic.

So, what properties do homomorphic mapped type have? Oh, and what about the `as` clause? It allows us to rename or even remove keys, theoretically altering the object's structure.

### instantiateMappedType

This function comes into play when it's necessary to instantiate a mapped type. Here's the catch:  homomorphic mapped types are handled in a special way, and you can observe this by examining the first if statement. Comments help us understand some of their special properties:

1. if the homomorphic mapped type is applied to a primitive type, the result is the primitive type itself

    ```ts
    HMT<1> = 1
    HMT<string> = string
    ```

1. if the homomorphic mapped type is applied to a union type, the result is the union of the mapped type applied to each member of the union

    ```ts
    HMT<A | B> = HTM<A> | HTM<B>
    ```

1. if the homomorphic mapped type is applied to an array, the result is still an array where the element type has been transformed by the logic of the mapped type

    ```ts
    type HMT<T> = { [P in keyof T]: F<T[P]> }

    HMT<A[]> = F<A>[]
    ```

1. if the homomorphic mapped type is applied to a tuple, the result is still a tuple where the element types have been transformed by the logic of the mapped type

    ```ts
    type HMT<T> = { [P in keyof T]: F<T[P]> }

    HMT<[A, B, C]> = [F<A>, F<B>, F<C>]
    ```

Basically, an homomorphic mapped type is going to iterate only over the numeric (`` number | `${number}` ``) keys of the array (tuple), leaving the rest untouched. The preservation of tuple and array types, however, happens only if `!type.declaration.nameType`. Now, I haven't quite nailed down the meaning of this `nameType` within the codebase, but I can assure you that if you use the `as` clause, then `type.declaration.nameType` contains whatever follows the clause, like a template literal or a conditional. It makes sense to lose tuple and array types if we rename the keys, as we would likely lose the specific numeric keys associated with these types.

Therefore, using the `as` clause doesn't disqualify a mapped type from being homomorphic; it simply has fewer properties.

```ts
function instantiateMappedType(type: MappedType, mapper: TypeMapper, aliasSymbol?: Symbol, aliasTypeArguments?: readonly Type[]): Type {
  // For a homomorphic mapped type { [P in keyof T]: X }, where T is some type variable, the mapping
  // operation depends on T as follows:
  // * If T is a primitive type no mapping is performed and the result is simply T.
  // * If T is a union type we distribute the mapped type over the union.
  // * If T is an array we map to an array where the element type has been transformed.
  // * If T is a tuple we map to a tuple where the element types have been transformed.
  // * Otherwise we map to an object type where the type of each property has been transformed.
  // For example, when T is instantiated to a union type A | B, we produce { [P in keyof A]: X } |
  // { [P in keyof B]: X }, and when when T is instantiated to a union type A | undefined, we produce
  // { [P in keyof A]: X } | undefined.
  const typeVariable = getHomomorphicTypeVariable(type);
  if (typeVariable) {
    const mappedTypeVariable = instantiateType(typeVariable, mapper);
    if (typeVariable !== mappedTypeVariable) {
      return mapTypeWithAlias(
        getReducedType(mappedTypeVariable),
        t => {
          if (t.flags & (TypeFlags.AnyOrUnknown | TypeFlags.InstantiableNonPrimitive | TypeFlags.Object | TypeFlags.Intersection) && t !== wildcardType && !isErrorType(t)) {
            if (!type.declaration.nameType) {
              let constraint;
              if (
                  isArrayType(t) || t.flags & TypeFlags.Any && findResolutionCycleStartIndex(typeVariable, TypeSystemPropertyName.ImmediateBaseConstraint) < 0 && (constraint = getConstraintOfTypeParameter(typeVariable)) && everyType(constraint, isArrayOrTupleType)
              ) {
                return instantiateMappedArrayType(t, type, prependTypeMapping(typeVariable, t, mapper));
              }
              if (isGenericTupleType(t)) {
                return instantiateMappedGenericTupleType(t, type, typeVariable, mapper);
              }
              if (isTupleType(t)) {
                return instantiateMappedTupleType(t, type, prependTypeMapping(typeVariable, t, mapper));
              }
            }
            return instantiateAnonymousType(type, prependTypeMapping(typeVariable, t, mapper));
          }
          return t;
        },
        aliasSymbol,
        aliasTypeArguments,
      );
    }
  }
  // If the constraint type of the instantiation is the wildcard type, return the wildcard type.
  return instantiateType(getConstraintTypeFromMappedType(type), mapper) === wildcardType ? wildcardType : instantiateAnonymousType(type, mapper, aliasSymbol, aliasTypeArguments);
}
```

### inferFromObjectTypes

Have you ever heard about reverse mapped types? If not, check this awesome talk by [Mateusz Burzyński](https://twitter.com/AndaristRake) at TypeScript Congress 2023: [Infer multiple things at once with reverse mapped types](https://portal.gitnation.org/contents/infer-multiple-things-at-once-with-reverse-mapped-types).

I refrain from posting the entire function, because it's extensive. When it comes to the possibility of reversing the action of a mapped type, however, the essence lies in the following lines:

```ts
if (getObjectFlags(target) & ObjectFlags.Mapped && !(target as MappedType).declaration.nameType) {
  const constraintType = getConstraintTypeFromMappedType(target as MappedType);
  if (inferToMappedType(source, target as MappedType, constraintType)) {
    return;
  }
}
```

Once again, we have `!(target as MappedType).declaration.nameType`, which prevents the inversion in the case of using the `as` clause. While being homomorphic isn't an absolute requirement for inversion, because even some non-homomorphic mapped types can be inverted, it does serve as a good indicator that TypeScript might pull off the inversion if there is no `as` clause.

### resolveMappedTypeMembers and getModifiersTypeFromMappedType

In short words, a mapped type of the form `{ [P in keyof T]: ... }`, where `T` may be a type variable or not, seems always to be able to preserve the modifiers of the original type `T`, that is called the _modifiers type_. Because homomorphic mapped types respect that form, they preserve the modifiers.

&nbsp;

## Conclusion

In conclusion, homomorphic mapped types are those that take the form `{ [K in keyof T (as ...)]: ... }`, where `T` is a type parameter, and the parentheses indicate that the `as` clause is optional. Homomorphic mapped types without the `as` clause are the cream of the crop, boasting special properties; those with the `as` clause aren't that bad, but they come with a few less features.
