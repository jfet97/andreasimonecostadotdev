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

In particolare abbiamo almeno una chiave dinamica, `D`, una chiave `key` e una chiave `children`, che è dove la ricorsione ha luogo, contenente appunto un array di entità aventi il medesimo tipo di quella che stiamo qua definendo.

Assegnamento ok perché array covarianti, esempio tipo ricorsivo con array
