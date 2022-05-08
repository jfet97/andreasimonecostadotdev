+++
author = "Andrea Simone Costa"
title = "Come intersecare una union di oggetti mantenendo l'unione tra le chiavi"
date = "2022-05-07"
description = "Come intersecare una union di oggetti mantenendo l'unione tra le chiavi"
categories = ["typescript"]
series = ["TypeScript"]
tags = [
    "union",
    "intersection",
]
featuredImage = "/images/merge_unions/copertina.png"
images = ["/images/merge_unions/copertina.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

# Il problema

L'operazione che vogliamo rendere possibile, a livello dei tipi, è quella di intersecare una unione di oggetti in un singolo oggetto. Ogni chiave `k` presente in uno qualsiasi dei costituenti della union di partenza apparirà nel tipo prodotto come output, e il tipo del valore corrispondente alla chiave `k` sarà l'unione di tutti i tipi dei valori della chiave `k` ovunque essa appariva nell'input.

Un semplice esempio, con il risultato desiderato:

```ts
type union =
  | { prop1: number, prop2: string }
  | { prop2: boolean, prop3: string[] }
  | { prop3?: [boolean] }

type result = {
  prop1: number,
  prop2: string | boolean,
  prop3: string[] | [boolean] | undefined
}
```

Abbiamo che la chiave `prop1` compare solo una volta nell'input e ha tipo `number`, e tale e quale viene riportata nel tipo risultante. La chiave `prop2` invece ha tipo `string` nel primo oggetto e `boolean` nel secondo, quindi risulta nella union `string | boolean`. Similmente `prop3` risulta nella union `string[] | [boolean] | undefined`, in quanto in uno degli input compariva come propietà opzionale.

# Soluzione

### AllKeys

Il primo componente della soluzione è la type function `AllKeys` così definita:

```ts
type AllKeys<T> = T extends unknown ? keyof T : never
```

la quale sfrutta la [distribution over union](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html#distributive-conditional-types) propria dei conditional type per estrarre tutte le possibili chiavi da una unione di oggetti:

```ts
type union =
  | { prop1: number, prop2: string }
  | { prop2: boolean, prop3: string[] }
  | { prop3?: [boolean] }

type unionAllKeys = AllKeys<union> // "prop1" | "prop2" | "prop3"
```

[Playground](https://www.typescriptlang.org/play?#code/C4TwDgpgBAggNnA0hEBnAPAFQHxQLxSZQQAewEAdgCapQCuFA1hQPYDuFUA-FIyiwDNCUAFxQKEAG4QATgG4AUAtCR6FAJYtOeBVCgAfKAG8oYGSzABGMRToBbAEayANKfNgATGNTAZ6igDmUAC+ugbGbhZeUA4sLHAQAIYUrmYWAMzevv4BANoAuiFhhiZpYOlcYrmx8UkUhaHK4NAMmhTwSCi0BB3IaOitWthAA)

### Lookup

La seconda type function, `Lookup`, distribuisce l'operazione di lookup con una chiave `K` su un tipo `T` rispetto ad una union di oggetti:

```ts
type Lookup<T, K extends PropertyKey> = T extends any ? T[K & keyof T] : never;
```

È interessante notare il fatto che la chiave `K` non è vincolata ad essere assegnabile a `keyof T`. TypeScript quindi non ci permette di indicizzare direttamente il tipo `T` con `K` (`T[K]`) in quanto non ha nessuna garanzia che `K` sia una chiave valida per `T`. Prima di indicizzare `T` con `K` filtriamo quest'ultima intersecandola proprio con `keyof T`: se `K` risulta essere una delle chiavi di `T` allora `T[K & keyof T]` è identico a `T[K]`, altrimenti è pari a `T[never]`, il cui risultato è `never`:

```ts
type obj = { prop1: number, prop2: string }

type test1 = Lookup<obj, "prop1"> // number
type test2 = Lookup<obj, "prop2"> // string
type test3 = Lookup<obj, "prop3"> // never
```

[Playground](https://www.typescriptlang.org/play?ssl=1&ssc=26&pln=1&pc=37#code/C4TwDgpgBAMg9nA1gVzAHgCoBooGkoQAewEAdgCYDOUACgE5yR2i4QgB8UAvFBgcWSpQAhqRBQA-LwDa+AGRREbOADNeAXSgAuKKQgA3CHQDcAKFOhIUOACMAVtygBvKGAZgAjDtLIAtjaMcN0YAJh1KYDoAS1IAcygAX3NLaBIIj0d4JFQ0WzscACJgzwLOAHoy3T8AugtwVIgIkMyEFHQ8wuKQ0qgKqAjouLqrNOAAZhbs9vtO9zGevr1DWvMgA)

Perché abbiamo bisogno di questo trick? Se costringessimo `K` ad essere assegnabile a `keyof T` nella definizione del tipo `Lookup` e `T` risultasse essere una union di oggetti, allora `K` potrebbe essere scelta solo tra le chiavi in comune:

```ts
type Lookup<T, K extends keyof T> = T extends any ? T[K] : never;

type union1 =
  | { prop1: number, prop2: string }
  | { prop2: boolean, prop3: string[] }
  | { prop3?: [boolean] }

type union2 =
  | { prop1: number, prop2: string, prop3: boolean[] }
  | { prop2: boolean, prop3: string[] }
  | { prop3?: [boolean] }


type test1 = Lookup<union1, never> // never
type test2 = Lookup<union2, "prop3"> // boolean[] | string[] | [boolean] | undefined
```

[Playground](https://www.typescriptlang.org/play?ssl=15&ssc=85&pln=1&pc=1#code/C4TwDgpgBAMg9nA1gVzAHgCoBooGkoQAewEAdgCYDOUiEIcAZlBgHxQC8zBxZVUAhqRBQA-MwDauALpQAXFFIQAbhABOAbgBQm0JCjJSASzikAjB01QoAHygBvKGFVwwp+aWQBbAEZqcTlwAmeUpgVUNSAHMoAF9LG3tHZzBgqG8EABsIQX9kgGYQsIjI8Rk4q1sHALA8kXlxdLgswTLtXWgDY1JAiwrE6rcFL19VXKDC8KixmvlG5tJS2PjKpPG0zOzSaYKoUMmS1r6q-LqoBo2WpbbwaBJQ8054JFQ0TpNTHEUVVTYAel+FMo1DoblA7sAeo8ECh0G9ujgAETVPIIv4AuabRa2PbFLFnDGXWwGcgQBgRCDkbRAA)

La union `union1` non possiede chiavi in comune tra tutti i costituenti, quindi `Lookup` sarebbe invocabile solo con `never` come tipo per `K`. Invece la union `union2` ha solo `prop3` come chiave condivisa, perciò `Lookup` è invocabile solo con `prop3` e con `never`. La regola da ricordare è la seguente: `keyof (A | B) = keyof A & keyof B`.

La definizione iniziale di `Lookup` ci lascia invece un maggiore spazio di manovra:

```ts
type union =
  | { prop1: number, prop2: string }
  | { prop2: boolean, prop3: string[] }
  | { prop3?: [boolean] }

type test1 = Lookup<union, "prop1"> // number
type test2 = Lookup<union, "prop2"> // string | boolean
type test3 = Lookup<union, "prop3"> // string[] | [boolean] | undefined
```

[Playground](https://www.typescriptlang.org/play?ssl=11&ssc=72&pln=3&pc=1#code/C4TwDgpgBAMg9nA1gVzAHgCoBooGkoQAewEAdgCYDOUACgE5yR2i4QgB8UAvFBgcWSpQAhqRBQA-LwDa+AGRREbOADNeAXSgAuKKQgA3CHQDcAKFOhIUZKQCWcUt1NQoAHygBvKGAZgAjDqkyAC2AEZGOD6MAEw6lMB0tqQA5lAAvs5unt6+sVChCAA2EKKRvgDMcQlJydKaGS7uXlFg5RI60gVwxaL15hbg0CTxftywCCjoNvakOABELX5znAD0K7oh4XQDVsPA0WPwSKho0w7zLdHLUGtQ8YkpWV09pDtDEPHlhxMnZ7NQCwq11u9xqdSynSKJVImncNnIEBUSQg5HMQA)

Nei risultati sono stati semplificati i `never` che teoricamente dovrebbero essere presenti nelle tre unioni, in quanto nessun costituente possiede tutte e tre le chiavi e quindi almeno un lookup fallisce sempre. Ricordiamo che per ogni tipo `A` è vero che `A | never` è identico ad `A`.

### MergeAsUnion

Ed eccoci arrivati finalmente alla type function `MergeAsUnion`:

```ts
type MergeAsUnion<T> = { [K in AllKeys<T>]: Lookup<T, K> };
```

Esso è un mapped type che itera su tutte le chiavi dell'unione `T`, condivise o meno, e per ognuna di esse effettua il lookup di `K` nell'unione `T` utilizzando la nostra type function `Lookup`:

```ts
type union =
  | { prop1: number, prop2: string }
  | { prop2: boolean, prop3: string[] }
  | { prop3?: [boolean] }

type result = MergeAsUnion<union>
/*
{
  prop1: number;
  prop2: string | boolean;
  prop3: string[] | [boolean] | undefined;
}
*/
```

[Playground](https://www.typescriptlang.org/play?#code/C4TwDgpgBAggNnA0hEBnAPAFQHxQLxSZQQAewEAdgCapQCuFA1hQPYDuFUA-FIyiwDNCUAFxQKEAG4QATgChQkKABkWLRnTBYANFETEylGlAAKMlpBmhkIXASKly1WgEMKIboQDa+gGS9+IUwAXVFxKVkAbgVwaABZWQBzCBhUAFUKAEsWCiw7KABvKB8oTM54JBQMHGCxVXVNHT1cAF9ouRilBmzOPDkoKAAfQqgwczAARjEKOgBbACNZXTGLACYxVGAZMsSoFv6hkZWwdah5tTgIN2XxgGYNrZ2vUP2B4aLj264xL3OWS7cLw6imgMggqDocGA+CgCRkyVSGR66G6OWwcgA9AAqOQFA7HKbiOaLGTRAbHU6bbYUXbDP4Aihk0Z3B7UxLPQ6-C5XCihYYMKgQARlCBUaL7LEYjpAA)
