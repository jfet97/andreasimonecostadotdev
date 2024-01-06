+++
author = "Andrea Simone Costa"
title = "What the heck is a homomorphic mapped type?"
date = "2023-12-28"
description = "Let's try to understand what the TypeScript guys mean when they talk about homomorphic mapped types"
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

The term _homomorphic_ is a bit of a stretch from its math roots, but it's basically saying that this kind of mapped type keeps the original type's structure intact. In fact, the [TypeScript wiki](https://github.com/microsoft/TypeScript/wiki/FAQ#faqs) states:

> Mapped types declared as `{ [ K in keyof T ]: U }` where `T` is a type parameter are known as homomorphic mapped types, which means that the mapped type is a structure preserving function of `T`.

Looking back, after getting cozy with the type system, the handbook's explanation makes more sense now. But hey, there's currently no up-to-date and complete definition. The new handbook doesn't even mention the term _homomorphic_, but it does appear in the source code.

I was just tired of not having the full picture, so I opened up the compiler and tried to figure out once and for all what the heck a homomorphic mapped type is.

## Under the hood

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

So, what properties do homomorphic mapped types have? Oh, and what about the `as` clause? It allows us to rename or even remove keys, theoretically altering the object's structure.

### instantiateMappedType

This function comes into play when it's necessary to instantiate a mapped type:

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
                  isArrayType(t) || t.flags & TypeFlags.Any && findResolutionCycleStartIndex(typeVariable, TypeSystemPropertyName.ImmediateBaseConstraint) < 0
                  && (constraint = getConstraintOfTypeParameter(typeVariable)) && everyType(constraint, isArrayOrTupleType)
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

Here's the catch: homomorphic mapped types are handled in a special way, and you can observe this by examining the first if statement. Comments help us understand some of their special properties:

1. if the homomorphic mapped type is applied to a primitive type, the result is the primitive type itself

    ```ts
    HMT<1> = 1
    HMT<string> = string
    ```

1. if the homomorphic mapped type is applied to a union type, the result is the union of the mapped type applied to each member of the union (therefore, TS often calls homomorphic mapped types __distributive__)

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

Basically, an homomorphic mapped type - without an `as` clause - iterates solely over the numeric (`` number | `${number}` ``) keys of the array (tuple) type, leaving the other keys untouched. Therefore the mapped type logic is applied only on element types.

The preservation of tuple and array types happens only if `!type.declaration.nameType`. If you use the `as` clause, then `type.declaration.nameType` contains whatever follows the clause, like a template literal or a conditional. It makes sense to lose tuple and array types if we rename or filter out some keys, as we would likely lose some or all the numeric keys. With an `as` clause, even a homomorphic mapped type currently iterates through all the keys of the array (tuple) type, but [this could change soon](https://github.com/microsoft/TypeScript/pull/55774).

Therefore, using the `as` clause doesn't disqualify a mapped type from being homomorphic. It simply doesn't preserve tuple and array types.

### resolveMappedTypeMembers and getModifiersTypeFromMappedType

In short words, __any__ mapped type of the form `{ [P in keyof T]: ... }`, where `T` may be a type variable or not, is able to preserve the modifiers of the original type `T`, that is called the _modifiers type_. Because all homomorphic mapped types respect that form, they do preserve the modifiers:

```ts
type HMT<T> = { [P in keyof T]: F<T[P]> }

HMT<{ readonly a: A, b?: B }> = { readonly a: F<A>, b?: F<B> }
```

If a mapped type has the form `{ [P in C]: ... }` where `C` is a type parameter and the costraint of `C` is `keyof T`, then the modifiers type is `T`. This let utility types like `Pick` preserve the modifiers of the original type, even though they are not homomorphic:

```ts
type Pick<T, K extends keyof T> = { [P in K]: T[P]; }

Pick<{ readonly a: A, b?: B }, "a"> = { readonly a: A }
```

Furthermore, homomorphic mapped types could preserve the symlinks between original and derived properties as well. Symlinks enable symbol navigation in the IDE (things like _"go to definition"_). Even this property is not exclusive to homomorphic mapped types: if modifiers can be preserved, then the possibility of maintaining the links is also being considered.

The following code snippet is taken from `resolveMappedTypeMembers`:

```ts
// stuff...

const shouldLinkPropDeclarations = getMappedTypeNameTypeKind(mappedType) !== MappedTypeNameTypeKind.Remapping;
const modifiersType = getModifiersTypeFromMappedType(type); // skipping some details

// other stuff...

const modifiersProp = something_something(modifiersType, ...); // skipping other details

// way more stuff...

if (modifiersProp) {
  prop.links.syntheticOrigin = modifiersProp;
  prop.declarations = shouldLinkPropDeclarations ? modifiersProp.declarations : undefined;
}
```

So, everything revolves around the value of `shouldLinkPropDeclarations`. This flag is `false` only if we are using an `as` clause for key remapping. In that case, the links are lost. If an `as` clause is employed just for key filtering or no `as` clause is used at all, then the links are preserved, provided that `modifiersProp` is not falsy.

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

Once again, we have `!(target as MappedType).declaration.nameType`, which prevents the reversion in the case of using the `as` clause. While being homomorphic isn't an absolute requirement for reversion, because even some non-homomorphic mapped types can be reverted, it does serve as a good indicator that TypeScript might pull off the reversion if there is no `as` clause.

**Achtung**: this might be enhanced soon, thanks to [this PR](https://github.com/microsoft/TypeScript/pull/52972). __Filtering__ mapped types are easier to revert than __renaming__ mapped types, so the `as` clause might not a big concert anymore if you use it just for filter out some keys.

## Conclusion

In conclusion, homomorphic mapped types are those that take the form `{ [K in keyof T (as ...)]: ... }`, where `T` is a type variable, and the parentheses indicate that the `as` clause is optional. Homomorphic mapped types without the `as` clause are the cream of the crop, boasting special properties; those with the `as` clause aren't that bad, but they come with a few less features. If a mapped type isn't homomorphic, it might still have some properties, like preserving modifiers, having symlinks to the original type, and the possibility of being reverted.

When crafting a mapped type, aim for homomorphism.
