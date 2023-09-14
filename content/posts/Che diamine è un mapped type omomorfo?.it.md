+++
author = "Andrea Simone Costa"
title = "Che diamine è un mapped type omomorfo?"
date = "2023-09-14"
description = "Cerchiamo di capire cosa intendono i signori del TypeScript quando parlano di homomorphic mapped type"
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

## Introduzione

Ricordo abbastanza bene l'occasione in cui lessi per la prima volta l'aggettivo _homomorphic_ riferito a un mapped type nel [vecchio handbook](https://www.typescriptlang.org/docs/handbook/advanced-types.html) di TypeScript. Ricordo soprattutto che la spiegazione del termine non mi era molto chiara.

Dopo aver listato un paio di mapped type di esempio:

```ts
type Nullable<T> = { [P in keyof T]: T[P] | null };
type Partial<T> = { [P in keyof T]?: T[P] };
```

L'handbook proseguiva dicendo:

> In these examples, the properties list is `keyof T` and the resulting type is some variant of `T[P]`. This is a good template for any general use of mapped types. That’s because this kind of transformation is __homomorphic__, which means that the mapping applies only to properties of `T` and no others.

Subito dopo sosteneva che anche `Pick<T, K extends keyof T> = { [P in K]: T[P]; }` è omomorfo, mentre `Record` non lo è:

> `Readonly`, `Partial` and `Pick` are homomorphic whereas `Record` is not. One clue that `Record` is not homomorphic is that it doesn’t take an input type to copy properties from. Non-homomorphic types are essentially creating new properties, [...].

&nbsp;

L'aggettivo _omomorfo_, per quanto sia un abuso del concetto matematico che vi sta dietro, vuole indicare il fatto che il mapped type preserva, mantiene la struttura del tipo sul quale opera. Devo ammettere che a distanza di tempo, dopo aver acquisito una buona familiarità con il type system, la spiegazione data dall'handbook mi pare più sensata di quanto mi sembrò allora. D'altra parte non è una definizione aggiornata. Anzi, non esiste una definizione aggiornata. Nel nuovo handbook il termine _homomorphic_ non compare nemmeno, ma nel codice sorgente compare eccome.

Tra gli argomenti del [workshop](https://www.eventbrite.it/e/biglietti-advanced-typescript-il-workshop-con-andrea-simone-costa-348278358947) che tenni nel 2022 figuravano anche i mapped type omomorfi. Cercai infatti di fornirne una definizione attuale in base alla mia esperienza e alle varie prove fatte, oltre a discuterne le principali proprietà. Ultimamente ho ripreso il materiale del workshop per aggiornarlo e migliorarlo, tenendo conto delle principali novità della versione `5` del linguaggio, oltre ad aggiungere tecniche e spunti che ho perfezionato nel corso dell'ultimo anno e mezzo. Chissà che non mi salti in mente di fare una seconda edizione eheh. In ogni caso, ho dovuto riprendere la domanda che dà il titolo a questo articolo.

## Il problema

La mia definizione di mapped type omomorfo sembrava essere un po' troppo lasca, alla luce di alcune proprietà che ero certo ogni mapped type omomorfo dovesse possedere. In particolare mi riferisco alla preservazione dei tipi tupla/array e alla possibilità di essere invertiti (ma questa è un'altra storia). Tuttavia, sembrava che queste proprietà andassero perse quando veniva utilizzata la clausola `as` per rinominare i field.

Restringere la definizione di mapped type omomorfo escludendo ogni mapped type che usi la clausola `as` è però eccessivo, poiché se ne scartano alcuni che TypeScript stesso considera omomorfi. Essi infatti posseggono proprietà, come la distribuzione rispetto all'unione, che sono proprie esclusivamente dei mapped type omomorfi.

## La soluzione

Mi sono stufato di andare avanti a tentativi e prove, ho aperto il compilatore e ho cercato di capire che diamine è un mapped type omomorfo una volta per tutte.

### getHomomorphicTypeVariable

Ecco la funzione che ci aiuta a rispondere alla domanda:

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

Un mapped type `{ [K in C]: ... }` è omomorfo se la sua constraint `C` è un `keyof X`, questo infatti è il significato del flag `TypeFlags.Index`, dove però `X` deve essere una type variable. È ovvio che le uniche type variable disponibili saranno quelle che il mapped type dichiara come input. Quindi gli esempi del vecchio handbook sono tutti corretti tranne `Pick`, che non è più considerato omomorfo da TypeScript.

Rimane ora da capire perché la clausola `as` crei così tanti problemi.

### instantiateMappedType

Questa funzione, della quale capisco si e no un 10% ma dettagli, entra in gioco quando è necessario istanziare un mapped type generico. Il punto è che i mapped type omomorfi hanno una gestione preferenziale come potete vedere, ma la preservazione dei tipi tupla/array avviene solo se `!type.declaration.nameType`. Ora, io il significato di codesto `nameType` all'interno della codebase non l'ho mica capito tanto bene, ma posso assicurarvi che se utilizzate la clausola `as` allora `type.declaration.nameType` contiene qualunque cosa segua la clausola, come un template literal o un conditional.

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
                isArrayType(t) || t.flags & TypeFlags.Any && findResolutionCycleStartIndex(typeVariable, TypeSystemPropertyName.ImmediateBaseConstraint) < 0 &&
                (constraint = getConstraintOfTypeParameter(typeVariable)) && everyType(constraint, isArrayOrTupleType)
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

Ha senso perdere i tipi tupla/array se rinominiamo le chiavi perché non avremmo più le chiavi numeriche proprie di questi tipi.

### inferFromObjectTypes

Evito di postare l'intera funzione sia perché è enorme, sia perché non ci capisco niente. Per quanto riguarda l'altra storia, ovvero la possibilità di invertire l'azione di un mapped type, il succo sono le seguenti righe:

```ts
if (getObjectFlags(target) & ObjectFlags.Mapped && !(target as MappedType).declaration.nameType) {
  const constraintType = getConstraintTypeFromMappedType(target as MappedType);
  if (inferToMappedType(source, target as MappedType, constraintType)) {
    return;
  }
}
```

Di nuovo abbiamo il `!(target as MappedType).declaration.nameType` che impedisce l'inversione nel caso in cui usiamo la clausola `as`. Non si controlla adesso se il mapped type è omomorfo perché pare che anche alcuni mapped type non omomorfi possano essere invertiti. Ma questa è decisamente un'altra storia, storia che racconterò solo nella prossima edizione del mio workshop. Che non esiste ancora. Però in caso vi faccio sapere, promesso.

## Conclusione

I mapped type omomorfi sono quelli aventi forma `{ [K in keyof T (as ...) ]: ... }` dove `T` è un type parameter e le parentesi tonde indicano che la clausola `as` è opzionale. I mapped type omomorfi senza clausola `as` sono i migliori mapped type esistenti, quelli con la clausola `as` non sono malaccio ma hanno qualche proprietà in meno.