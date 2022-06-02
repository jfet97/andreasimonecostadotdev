+++
author = "Andrea Simone Costa"
title = "Come invertire una type map"
date = "2022-06-02"
description = "Vediamo come ottenere la chiave corrispondente ad un tipo presente in una type map"
categories = ["typescript"]
series = ["TypeScript"]
tags = [
    "type map",
    "keyof",
    "mapped types",
]
featuredImage = "/images/invertire_typemap/copertina.png"
images = ["/images/invertire_typemap/copertina.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

# Il problema

È comune, in TypeScript, raggruppare un insieme di tipi aventi una particolare relazione in quelle che vengono definite type map, ovvero interfacce che associano ad ognuno dei tipi nell'insieme una o più chiavi per facilitarne il recupero. Un esempio per tutti è la [`HTMLElementTagNameMap`](https://github.com/microsoft/TypeScript/blob/main/lib/lib.dom.d.ts#L18029-L18147), la quale associa al nome di ogni elemento del DOM il tipo corrispondente:

```ts
interface HTMLElementTagNameMap {
  "a": HTMLAnchorElement;
  "abbr": HTMLElement;
  "address": HTMLElement;
  "area": HTMLAreaElement;
  "article": HTMLElement;
  "aside": HTMLElement;
  "audio": HTMLAudioElement;
  "b": HTMLElement;
  ...
}
```

Vediamo come poter eseguire l'operazione inversa: dato un tipo che sappiamo essere presente in una type map otteremo tutte le sue chiavi.

# La soluzione

Andremo a creare una type function semanticamente equivalmente alla seguente:

```ts
function InvertTypeMap(TypeMap, Type) {
  type ResultingKeysUnion = never

  for(Key in TypeMap) {
    if(TypeMap[Key] is Type) {
      ResultingKeysUnion = ResultingKeysUnion | Key
    }
  }

  return ResultingKeysUnion
}
```

In essa iteriamo tutte le chiavi della `TypeMap` e `Key` dopo `Key` valutiamo se `TypeMap[Key]` è il tipo di cui vogliamo ottenere le chiavi. Solo in caso affermativo la `Key` viene aggiunta alla union da restituire.

Vediamo quindi come esprimere tale funzione nel type system del linguaggio:

```ts
type InvertTypeMap<TypeMap, Type> = {
  [Key in keyof TypeMap]: Type extends TypeMap[Key]
    ? TypeMap[Key] extends Type
      ? Key
      : never
    : never;
}[keyof TypeMap];
```

Utilizziamo un mapped type per iterare le chiavi di `TypeMap`, e per ogni `Key` controlliamo la mutua assegnabilità - che non è la migliore definizione di uguaglianza tra tipi in TypeScript, ma è sufficiente nella maggior parte dei casi - tra `TypeMap[Key]` e `Type`: in caso affermativo il tipo corrispondente alla `Key` viene rimappato nella `Key` stessa, altrimenti in `never`. Andiamo infine ad eseguire il lookup con tutte le chiavi possibili, `[keyof TypeMap]`, in modo tale da ottenere la union desiderata. Ricordiamo che il tipo `never` è l'elemento neutro dell'unione tra tipi: per ogni tipo `T` vale che `T | never` è pari a `T`.

Possiamo vedere `InvertTypeMap` all'opera [in questo playground](https://www.typescriptlang.org/play?target=99&jsx=0#code/C4TwDgpgBAkgdgNwgJ2AFXBAsgQzAHg0lzABooiIA+KAXigG8AoKKAbQGkIQoBLOKAGtuAewBmFTCQC6ALkmQoEAB7AIcACYBnBdjydu0lqygB+XSQMhpS1eu27jJs1C4gnJ+XAhJkHrz4oANxMAL5swiDiFnjSIUwA9AlQALRp6RlMTPxqyGI4AMbQlCSMxpEAjF4ArgC2AEYo5dwATPJawMj8AObNIADM8vUiIgA2EDhwbEahWaCKaAAMdLCIKOhSeISbZFBwdY3IVInJrAB6pkzzxRUr8L4bxFsleOTDYxNT0sdJJhdzmAoLTua1QLwIAAk0FgADIAUXGtXU6Bw3QAcjgkSRyFDYQiIEi4MAfqcoP9rhR+iCHuD8Lj4YjkWhURisa8oPSAIJwAoACxEyHxhOJJz+piAA).