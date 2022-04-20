+++
author = "Andrea Simone Costa"
title = "Come accedere in modo safe agli elementi di una tupla"
date = "2022-04-20"
description = "Come accedere in modo safe agli elementi di una tupla"
categories = ["typescript"]
series = ["TypeScript"]
published = false
tags = [
    "types",
    "tuple",
    "generics",
]
featuredImage = "/images/safe_tuple/safe_tuple.png"
images = ["/images/safe_tuple/safe_tuple.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

# Il problema

TypeScript controlla di default che l'accesso diretto agli elementi di una tupla presente nello scope sia safe:

```ts
const tuple = [1, "due", { tre: 4 }] as const

tuple[0] // ok

tuple[4] // Tuple type 'readonly [1, "due", { readonly tre: 4; }]' of length '3' has no element at index '4'.
```

[Playground](https://www.typescriptlang.org/play?jsx=0#code/MYewdgzgLgBFCuAHANgUxgXhgbQIwBoYAiAE3lSMIG84AnVALhgBYYBfAXRgEMIZRIUAFBCEKVNgAMXAPQyYIANYixabM1nyAKkjRwAnonQByetxLhk+nAWJkK1GGYtgrdRiwDc7DsYUAzGDQwAHMoAAsYYwBmP3DeGDAQGFQ0AFtUMFhuWABLMBJUAA8o5mMAOiA)

Quando invece abbiamo a che fare con funzioni generiche che prendono come input tuple o array, non è presente alcun controllo:

```ts
function get<T extends any[]>(tuple: [...T], index: number): T[number] {
  tuple[500] // ok
  return tuple[index] // ok
}
```

[Playground](https://www.typescriptlang.org/play?jsx=0#code/GYVwdgxgLglg9mABAcwKZQDwBVGoB5SpgAmAzogIZgCeA2gLoB8AFFCAA4A2qAXIrQDohWegBpEMEvj5gQAWwBGqAE4BKPllqzFK+ogDeAKESI2XVLQCsABmt6A9PcRwA1scTL0IZUjPdaksT4Dk6uhgC+QA)

dove `tuple` è tipizzato con `[...T]` anziché `T` perché questo impone al type checker di inferire una tipo tupla se la funzione viene invocata su una tupla e non su un array:

```ts
declare function get<T extends any[]>(tuple: [...T], index: number): T[number]
get([1,2,3], 1) // T inferred as [number, number, number]
get([1,2,3] as Array<number>, 1) // T inferred as number[]


declare function get2<T extends any[]>(tuple: T, index: number): T[number]
get2([1,2,3], 1) // T inferred as number[]
get2([1,2,3] as Array<number>, 1) // T inferred as number[]
```

[Playground](https://www.typescriptlang.org/play?jsx=0#code/CYUwxgNghgTiAEAzArgOzAFwJYHtXwHMQMAeAFXhAA8MRVgBneKVATwG0BdAPgAoNkABwggAXPHYA6aWU4AaeFnrVxqZAFsARiBgBKcWXZqtOzgCgiGXuwCMcgExyAzPPg3d8APSf4FJYh04YGYmIw1tGAVjCKjw0wtiaztHFxD4AEEYGChWEmidbgV3Lx8-VACskGCoJnyYLjNG0EhYBBR0bDxCYntySho6RmY2Lj4BYTFfBSVQKlU4vQMwkxhzS3skh2dXYu9fRXLAqrS6hvXNlM40zOzcusK3Dz2yiqCTha4gA)

Purtroppo TypeScript non ci permette di garantire a tempo di compilazione che l'accesso ad un elemento di un array sia sempre safe; per fare questo servono i dependent types. Se ci limitiamo però alle tuple, ovvero ad array dichiarati staticamente, possiamo nuovamente rendere funzioni come la `get` sopra più sicure. Nulla ci impedirà di accedere a `tuple[500]`, però possiame costringere l'indice `i` proveniente dall'esterno ad essere corretto per la tupla in questione, oltre bloccare l'uso della funzione se in ingresso viene rilevato dal type system un array anziché una tupla.

# La soluzione

Per risolvere il problema abbiamo prima bisogno di creare alcune type function utili.

## NumberToString

```ts
type NumberToString<N extends number | bigint> = `${N}`;
```

Questa type function prende in ingresso un qualsiasi tipo numerico e restituisce il corrispondente tipo ma sottoforma di stringa:

```ts
const ten: NumberToString<10> =  "10"
const whatever: NumberToString<number> = "123"
```

[Playground](https://www.typescriptlang.org/play?jsx=0#code/C4TwDgpgBAcgrgWwEYQE4BUD2BlYqCWAdgOYA8MUEAHsBIQCYDOUhiKqUAPlEvsUcAB8UALxQABgBIA3jAC+4gNwAoZQGNMhRsCi1CALlhs0WXARKkAjAAZhYqACIbD9Zu1QA7gAsAhrQBuaIbwyCY4eERkrKGodo6WAEwAzA5AA)

Per fare ciò facciamo uso dei [template literal types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html).

## IndexesKeysOfTuple

```ts
type IndexesKeysOfTuple<T extends any[]> = Exclude<
  keyof T & string,
  keyof any[]
>;
```

Questa type function, leggermente più complessa, restituisce una union di stringhe contenenti le chiavi numeriche utilizzabili in modo safe sulla tupla:

```ts
type test1 = IndexesKeysOfTuple<[]> // never
type test2 = IndexesKeysOfTuple<[1, 2, 3]> // "0" | "1" | "2"
type test3 = IndexesKeysOfTuple<Array<string>> // never
```

[Playground](https://www.typescriptlang.org/play?jsx=0&ssl=8&ssc=56&pln=1&pc=1#code/C4TwDgpgBAkgdgEwgDwgZwNIRGg8gMwBUBXMAGwgB5CoVgJE0oBDOEAbQF0A+KAXigBRZAGMyxJJQBQUKAGtsAe3xQaAMihpgAJwCWcAOYAaGfKUrWHTlO4BuKVNCQo9LQEZ+sRCnRYcBEnIqLl4AelCoOAgANwhtR3BoV2AAJk94JFRMbDwiUgpKdjcjKBSSgGYeKHCoACIABlqoAB86tybW2pTahOdk8vTvLL9cwIKAQW1tZhBKLT1DbjCIqNjtIA)

Notiamo che sia sulla tupla vuota che su un generico array restituisce `never`, indicante un insieme vuoto.

Cerchiamo ora di comprendere meglio la stregoneria che c'è dietro. In primo luogo `keyof T & string` restituisce l'unione di tutte le chiavi stringa presenti in una generica tupla; `& string` serve proprio per filtrare via le chiavi che non sono stringhe:

```ts
type StringKeys = keyof [1, 2, 3] & string
/*
"0" | "1" | "2" | "length" | "toString" | "toLocaleString" | "pop" | "push" | "concat"
| "join" | "reverse" | "shift" | "slice" | "sort" | "splice" | "unshift" | "indexOf" | "lastIndexOf"
| ... 14 more ... | "includes"
*/
```

[Playground](https://www.typescriptlang.org/play?jsx=0#code/C4TwDgpgBAysBOBLAdgcwNIRAZygXigGssB7AMygG0BGAGigCZ6BmAXSgDIpsEVUAoAPQAqfgCIADGKgAfKGOrS5YhkvkAbCGmAALNWOAk4SNPsMAZEgGMAhpuN99YEmCcBXbHtnyrJZLeAxfmUAKxIUfXgIADcIeGwIfU9EMkDvMWx1RCtE9OwSeDTlbDAsnP03ZGTU-RQAEwgADwB5Mn11Gx4ASWQGlrbgqAA6EahqABYoAFsC6BGh9JQrdTcG7CDhQSA)

D'altra parte `keyof any[]` restituisce l'unione di tutte le possibili chiavi stringa utilizzabili su un generico array, le quali sono praticamente tutte quelle utilizzabili su una tupla __tranne__ chiavi come `"0"`, `"1"`, ecc. Ecco che `Exclude` andrà ad eliminare tutte le altre:

```ts
type StringKeys = Exclude<keyof [1, 2, 3] & string, keyof any[]> // "0" | "1" | "2"
```

[Playground](https://www.typescriptlang.org/play?jsx=0#code/C4TwDgpgBAysBOBLAdgcwNIRAZygXigFEAPAYwBsBXAEwgB4BrLAewDMoBtARgBooAmPgGYAulABkUbAhSo+TEGygBDZCA4iAfFAD0OqACIADAagAfQ11MWD-A0A)

## ValidIndex

```ts
type ValidIndex<T extends any[], I extends number> = 
  NumberToString<I> extends IndexesKeysOfTuple<T>
  ? I
  : never;
```

Questa type function semplicemente controlla se il tipo indice `I`, trasformato in stringa, faccia parte degli indici safe utilizzabili sulla tupla `T`. In caso positivo restituisce `I` stesso, altrimenti `never`:

```ts
type test1 = ValidIndex<[1, 2, 3], 1> // 1
type test2 = ValidIndex<[1, 2, 3], 4> // never
type test3 = ValidIndex<Array<string>, 1> // never
```
[Playground](https://www.typescriptlang.org/play?jsx=0&ssl=15&ssc=51&pln=13&pc=1#code/C4TwDgpgBAkgdgEwgDwgZwNIRGg8gMwBUBXMAGwgB5CoVgJE0oBDOEAbQF0A+KAXigBRZAGMyxJJQBQUKAGtsAe3xQaAMihpgAJwCWcAOYAaGfKUrWHTlO4BuKVNCQoAOWIBbAEYRthRQGUdfQNKF1pkekYoOA9vbSgAHyhPXQN9YF4BAAMAEgBvFwBfLPtHcGgANWYyXQR4JGRqcMiEJksuI1hmhlbo2J9MqFM3Lx8-QL1DShheOh6mepR0LBwCEnIqQm5TAH5YUwAuaIgANx9Sp2h6LQBGfigqmrrEFEp2G86AJk6AZk5Om68AD0QKgNzKzmuwE+90etUWjXeX1+-ygABZgaC4KcfBCruhgD9YdV4S9GgBBbTaZggShaSYGbgAzHHM7aIA)

Osserviamo che se l'indice non è safe oppure se `T` è una tupla anziché un array allora il risultato è il tipo `never`. 