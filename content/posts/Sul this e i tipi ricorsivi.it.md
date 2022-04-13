+++
author = "Andrea Simone Costa"
title = "Sul this e i tipi ricorsivi"
date = "2022-04-13"
description = "Come mantenere la corretta autoreferenza quando estendiamo un tipo ricorsivo"
categories = ["typescript"]
series = ["TypeScript"]
tags = [
    "types",
    "recursive",
    "this",
]
featuredImage = "/images/this_tipi_ricorsivi/carbon.png"
images = ["/images/this_tipi_ricorsivi/carbon.png"]
published = false
+++

__Series__: [TypeScript](/it/series/typescript/)

# Introduzione

La ricorsione, incubo di ogni sviluppatore wannabe, la troviamo in TypeScript anche nel type system, specialmente dalla versione `3.7` che ne ha notevolmente aumentato il supporto. Ad esempio è possibile rappresentare il `JSON` in questo modo:

```ts
type JSON =
    | string
    | number
    | boolean
    | null
    | { [property: string]: JSON }
    | JSON[];
```

Il problema che discuteremo in questo episodio, estrapolato da un caso d'uso reale, ha a che fare proprio con un tipo ricorsivo e con la necessità di estenderlo.

# Il problema

Il tipo ricorsivo con cui abbiamo a che fare è il seguente:

```ts
type Recursive<D extends string> = {
  [K in D]: string;
} & {
  key: string;
  children: Recursive<D>[];
};
```

In particolare abbiamo almeno una chiave dinamica, `D`, una chiave `key` e una chiave `children`, che è dove la ricorsione ha luogo, contenente appunto un array di entità aventi il medesimo tipo di quella che stiamo qua definendo.\
Il codice problematico è il seguente:

```ts
type FlattenRecursive = 
  <D extends string, R extends Recursive<D>>(rs: R[]) => Omit<R, "children">[] 

const flatten: FlattenRecursive =
  rs => rs.flatMap(r => flatten(r.children))
```

[Playground](https://www.typescriptlang.org/play?target=99&jsx=0#code/C4TwDgpgBAShDGBXATgZwJYDcIB4AiUEAHsBAHYAmqUqwy6ZA5gHxQC8UA3gFBRQDaAaSgMoeALoAuGnQaMA3NwC+UAGRdeUANYQQ02vSaK+8ABboANhWTlpcJGiy48zfuMVLF3UJCgAxCwBDYFIyexQMbHYoTXxCEnIqGUNGABpYeNCk8MdsfGZmAAo0OzcASnZWAHkAW3RgHBh0gCIzS2tyZtdxGO54AHsyWigAMyCQ239x0JzI6A5NNEqoNAA6MeCAWUCwYuWNibJi1barGzIysu4gA)

nel quale semplicemente vogliamo spacchettare la struttura ricorsiva in un array flat di oggetti simili ai `Recursive` ma senza la proprietà `children`, che appunto è stata ricorsivamente appiattita.\
It was all fun and games until TypeScript says:

```ts
Type 'Omit<Recursive<D>, "children">[]' is not assignable to type 'Omit<R, "children">[]'.
  Type 'Omit<Recursive<D>, "children">' is not assignable to type 'Omit<R, "children">'.
    Type 'Exclude<keyof R, "children">' is not assignable to type '"key" | Exclude<D, "children">'.
      Type 'keyof R' is not assignable to type '"key" | Exclude<D, "children">'.
        Type 'string | number | symbol' is not assignable to type '"key" | Exclude<D, "children">'.
          Type 'string | number | symbol' is not assignable to type '"key" | Exclude<D, "children">'.
            Type 'string' is not assignable to type '"key" | Exclude<D, "children">'.
```

<img src="/images/this_tipi_ricorsivi/what.jpeg" width="550" style="display: block;margin-left: auto;margin-right: auto;" alt="what"/>

Keep calm e concentriamoci sulla prima riga: stiamo erroneamente cercando di assegnare qualcosa di più generale, un `Omit<Recursive<D>, "children">[]`, dove è richiesto un qualcosa di più specifico, ovvero un `Omit<R, "children">[]`. In effetti il tipo di `r.children` è tipizzato come un generico `Recursive<D>`, quindi la `flatten` ricorsiva può solo restituire un `Omit<Recursive<D>, "children">[]`. Il nocciolo del problema sta nel fatto che `Recursive<D>` non è assolutamente obbligato ad essere uguale al tipo `R`:

```ts
type RValueAnimal = Recursive<"value"> & { animal: string }
type RValuePerson = Recursive<"value"> & { person: string }

const rvalues: RValueAnimal[] = [
  {
    key: "string1",
    value: "v1",
    animal: "a1",
    children: []
  },
  {
    key: "string2",
    value: "v2",
    animal: "a2",
    children: []
  },
  {
    key: "string3",
    value: "v3",
    animal: "a3",
    children: []
  },
]

const rprop: RValuePerson = {
  key: "string4",
  value: "v4",
  person: "p1",
  children: rvalues
}
```

[Playground](https://www.typescriptlang.org/play?target=99&jsx=0&ssl=6&ssc=3&pln=2&pc=1&ts=next#code/C4TwDgpgBAShDGBXATgZwJYDcIB4AiUEAHsBAHYAmqUqwy6ZA5gHxQC8UA3gFBRQDaAaSgMoeALoAuGnQaMA3NwC+UAGRdeUANYQQ02vSaK+8ABboANhWTlpcJGiy48zfuMVLF3bqEiwAagCGFogQAIJk6AC2weywCCgY2DgARJjBoSms6pxQgZExFvqyTFBKPuDQMEEhEAAKEGgA9mRx9olOqem1WWpcUJDNZMWGjGXe8C20UMjdoah2NaER0cFucfyaPHx8OnpQKQZyAIwpADSafHMQ0mmnFzt5BcG3gfeXUGaW1rYC4ppKB4aR57W5HJgAJnOH2ut0wUKBfHyqyKB0CCI+XysNmGfwBQO2O1BB3BjAAzNDHrCDpgKYinijXnTMeZsb83PjuP9uJMyNNkGBkE0wIsMvVGqgWnFCcTDiVGAAWSlQalpJVAwaS3EpMDvEysn642Zi1DKIA)

Nell'esempio due diversi tipi che estendono il medesimo `Recursive<D> = Recursive<"value">`. La definizione del tipo `Recursive` che abbiamo non ci impedisce di assegnare alla chiave `children` di un `RValuePerson` un array di `RValueAnimal`, o viceversa, perché `children` ha l'unica costrain di essere un `Recursive<"value">` e sia `RValuePerson` che `RValueAnimal` soddisfano questo vincolo.

Assegnamento ok perché array covarianti, esempio tipo ricorsivo con array
