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

Semplicemente vorremmo spacchettare la struttura ricorsiva in un array flat di oggetti di tipo `R extends Recursive<D>` privati della proprietà `children`, che appunto è stata ricorsivamente appiattita. TypeScript però non è molto d'accordo:

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

Keep calm e concentriamoci sulla prima riga: stiamo erroneamente cercando di assegnare qualcosa di più generale, un `Omit<Recursive<D>, "children">[]`, dove è richiesto un qualcosa di più specifico, ovvero un `Omit<R, "children">[]`. In effetti il tipo di `r.children` è tipizzato come un generico `Recursive<D>`, quindi la `flatten` ricorsiva può solo restituire un `Omit<Recursive<D>, "children">[]`.\
Il nocciolo del problema sta nel fatto che `Recursive<D>` non è assolutamente obbligato ad essere uguale al tipo `R`:

```ts
type RValueAnimal = Recursive<"value"> & { animal: string }
type RValuePerson = Recursive<"value"> & { person: string }

const rAnimals: RValueAnimal[] = [
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

const rPerson: RValuePerson = {
  key: "string4",
  value: "v4",
  person: "p1",
  children: rAnimals // <-- qualquadra non cosa
}
```

[Playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=4.7.0-dev.20220408#code/C4TwDgpgBAShDGBXATgZwJYDcIB4AiUEAHsBAHYAmqUqwy6ZA5gHxQC8UA3gFBRQDaAaSgMoeALoAuGnQaMA3NwC+UAGRdeUANYQQ02vSaK+8ABboANhWTlpcJGiy48zfuMVLF3bqEiwAagCGFogQAIJk6AC2weywCCgY2DgARJjBoSms6pxQgZExFvqyTFBKPuDQMEEhEAAKEGgA9mRx9olOqem1WWpcUJDNZMWGjGXe8C20UMgR0cGodjWhc4VucfyaPHx8OnpQKQZyAIwpADSafN2h0mmnFzt5BcG3gfeXUGaW1rYC4ppKB4aR57W5HJgAJnOH2uEFumChQL4+XmRQOgURHy+Vhswz+AKB2x2oIO4MYAGZoY9YfDKUinqjXnSseYcb83ATuP9uJMyNNkA0hksMvVGqgWnEiSTDiVGAAWKlQGkHTAKoGDcV4lJgd4mVk-PGzZ4WVDKIA)

Nell'esempio creiamo due diversi tipi che estendono il medesimo `Recursive<D> = Recursive<"value">`. La definizione corrente del tipo `Recursive` non ci impedisce di assegnare alla chiave `children` di un `RValuePerson` un array di `RValueAnimal`, o viceversa, perché `children` ha l'unica costrain di essere un `Recursive<"value">` e sia `RValuePerson` che `RValueAnimal` soddisfano questo vincolo. Se invocassimo la `flatten` su `rPerson.children` l'array risultante sarebbe un `Omit<RValueAnimal, "children">[]` che non ha nulla a che vedere con il tipo `Omit<RValuePerson, "children">[]` atteso.

Come possiamo impedire di avere l'array `children` out of sync?

# La soluzione

Nelle interfacce che creiamo in TypeScript possiamo referenziare il tipo corrente. La cosa interessante è il fatto che il `this` type rimane coerente con eventuali estensioni di una interfaccia:

```ts
interface Rec {
   rec: this
}

interface RecExt extends Rec {
    prop: number
}

type RexExt2 = RecExt & { key: string }

type r = Rec["rec"] // Rec
type re = RecExt["rec"] // RecExt
type re2 = RexExt2["rec"] // RexExt2
```

[Playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=4.7.0-dev.20220408#code/JYOwLgpgTgZghgYwgAgEoQcg3gKGfqDALmTAAtgBnHAXxx1ElkRXQQFEAPMZCbiEABNKaDNjz5kABygB7KSRABXALYAjaLXpgAnlNZ8uYAEzIAvKI7dkAMmzIA1hB0lKYKKADmyOjl37kKHNLAG0AIkIEMIBdZAB6OMs-PRRCYLYjcMiY+MSM7mSAwlMLdE4jYyyMHITRcu5jIA)

Modifichiamo quindi il tipo `Recursive` come segue:

```ts
interface Rec {
  key: string;
  children: this[]; // <-- notare il this
}
type Recursive<D extends string> = {
  [K in D]: string;
} & Rec;
```

Siamo costretti a separare le due parti sia perché il tipo `this` può essere utilizzato solo nelle interfacce, sia perché ai mapped type non piace che siano dichiarate in parallelo altre proprietà. La cosa importante è il fatto che ogni volta che `Rec` verrà esteso, il `this` si allineerà alla chain "puntando" sempre al "tipo corrente".

Riprendiamo prima in mano l'esempio di `RValuePerson` e `RValueAnimal`:

```ts
type RValueAnimal = Recursive<"value"> & { animal: string }
type RValuePerson = Recursive<"value"> & { person: string }

const rAnimals: RValueAnimal[] = [
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

const rPerson: RValuePerson = {
  key: "string4",
  value: "v4",
  person: "p1",
  children: rAnimals // <- adesso è un errore
}
```

[Playground](https://www.typescriptlang.org/play?target=99&jsx=0#code/JYOwLgpgTgZghgYwgAgEoQcg3gKGcgawgE8AuZAZzClAHMBuPZBAC2ABsATKCEcsNhQDaAXUYBfHGGIAHFOgQBXKBWAA3CAB4AIsggAPSCE4VK1OgD5kAXmxMhAaWShk2keSo0QDHOOQAyNAxGKVl5ADU4dkUIAEEQYABbKJsgpRV1LQAiNSiYrKtArGQ4BOT2D3NvZElpOTRI6IgABWgKAHsQVIVlVQ1NHLyIAoDsZDkVTsqvWhqcHAROqmQoeKSoinJURpi18tFUoSZcfHwiMmQszzoARiyAGiZ8XKbyHLvH05KyqLe4D6ezDYXB4fGQoiY4k+di+5ze128ACYHoCXjE3mpkdD8KV1hVLnAsYDWBxuLxyBD8FDjoC4ZcEbQAMwor5oiAY5nY754v6c4nAslgyk1R4ieaLEDLKCtSZg7ZDGUdLq2E6EEjwqq0AAsLOQbIxOuhEyVbxkAPwJJB5JWew2vhwQA)

Adesso non possiamo più assegnare un array di `RValueAnimal` alla propietà `children` di un `RValuePerson`, perché grazie al `this` essa è correttamente tipizzata come `RValuePerson[]`.

Ed ecco che abbiamo risolto il problema iniziale, in quanto `r.children` adesso è correttamente tipizzato come `R[]` e quindi la chiamata ricorsiva a `flatten` restituisce l'`Omit<R, "children">[]` desiderato:

```ts
interface Rec {
  key: string;
  children: this[];
}
type Recursive<D extends string> = {
  [K in D]: string;
} & Rec;

type FlattenRecursive = 
  <D extends string, R extends Recursive<D>>(rs: R[]) => Omit<R, "children">[] 

const flatten: FlattenRecursive = 
  rs => rs.flatMap(r => flatten(r.children))
```

[Playground](https://www.typescriptlang.org/play?target=99&jsx=0#code/JYOwLgpgTgZghgYwgAgEoQcg3gKGcgawgE8AuZAZzClAHMBuPZBAC2ABsATKCEcsNhQDaAXUYBfHGGIAHFOgQBXKBWAA3CAB4AIsggAPSCE4VK1OgD5kAXmxMhAaWShk2keSo0QDHOOQAyNAxGKVkUADF2ODAjBWVVDRtkJh09Q14TMy9aABo0NKNMuJV1LW0LCwAKFXJUUQBKGysAeQBbYDBNVDyAIlYObl4ei1FknAQAexAqZBgomN5ySOjYjHjSpKYVJuQVADo56IBZOBlqncOFkGq9-q4eEHr6nCA)

# TypeScript colpisce ancora

Vi è purtroppo un secondo problema, e ce ne accorgiamo se proviamo a invocare la `flatten` sull'array `rAnimals`:

```ts
const rAnimals: RValueAnimal[] = [
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

const flatten: FlattenRecursive = 
  rs => rs.flatMap(r => flatten(r.children))

flatten(rAnimals) // <-- Argument of type 'RValueAnimal[]' is not assignable to parameter of type 'Recursive<string>[]'
```

[Playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=4.7.0-dev.20220408#code/JYOwLgpgTgZghgYwgAgEoQcg3gKGcgawgE8AuZAZzClAHMBuPZBAC2ABsATKCEcsNhQDaAXUYBfHGGIAHFOgQBXKBWAA3CAB4AIsggAPSCE4VK1OgD5kAXmxMhAaWShk2keSo0QDHOOQAyNAxGKVl5ADU4dkUIAEEQYABbKJsgpRV1LQAiNSiYrKtArGQ4BOT2D3NvZEkcBAB7ECpkKHikqIpyVEjouLKo0VShJlx8fCIyZCzPOgBGLIAaJnxc3vIc+aWxkv6KqbhN5eY2Lh4+ZFEmcS27bYn1me8AJkWj1Zj1tReb-FL2vaycG+R1YHG4vHIl3w1xGR3uU0etAAzK9tu8IJ8UT8dv91nAsSCTuDzlCaksRDhQnJkAAxdhwMBGBTKVQaVJMHR6Qy8ExmLy0BZoLlGXnMjIaHQWCwAChUXVEAEobFYAPKJYBgTSoQVZUGnXgFQaUhpNMDIGD0xkQ2mWpkYFmZdn4FTKloUAB0FoZAFk4DJZa6vVaQLL3XriQqFZSg0ZZW1yhQFUA)

Notiamo che i type parameter inferiti nella chiamata sono `string` e `Recursive<string>>` anziché i `"value"` e `Recursive<"value">>` attesi:

```ts
const flatten: <string, Recursive<string>>(rs: Recursive<string>[]) => Omit<Recursive<string>, "children">[]
```

Ci stiamo scontrando con una limitazione del type system, [il quale non utilizza le costrain sui generici come punti dai quali fare inferenza per altri generici](https://github.com/microsoft/TypeScript/issues/7234). Ecco che il type parameter `D` che compare nella costrain di `R` non può essere inferito da quest'ultimo, il quale ipotrebbe essere determinato a partire dall'argomento `rAnimals`, e quindi viene considerato pari al suo upper bound `string` come tipo di ripiego.

Per risolvere questo primo problema sfruttiamo il fatto che il tipo `Recursive` è ora intersezione di due tipi per ristrutturare il tipo della `flatten`:

```ts
type FlattenRecursive = 
  <R extends Rec>(rs: R[]) => Omit<R, "children">[] 
```

[Playground](https://www.typescriptlang.org/play?target=99&jsx=0&ts=4.7.0-dev.20220408#code/JYOwLgpgTgZghgYwgAgEoQcg3gKGcgawgE8AuZAZzClAHMBuPZBAC2ABsATKCEcsNhQDaAXUYBfHGGIAHFOgQBXKBWAA3CAB4AIsggAPSCE4VK1OgD5kAXmxMhAaWShk2keSo0QDHOOQAyNAxGKVl5ADU4dkUIAEEQYABbKJsgpRV1LQAiNSiYrKtArGQ4BOT2D3NvZEkcBAB7ECpkKHikqIpyVEjouLKo0VShJlx8fCIyZCzPOgBGLIAaJnxc3vIc+aWxkv6KqbhN5eY2Lh4+ZFEmcS27bYn1me8AJkWj1Zj1tReb-FL2vaycG+R1YHG4vHIl3w1xGR3uU0etAAzK9tu8IJ8UT8dv91nAsSCTuDzlCaksRDhQnJkAAxdhwMBGBTKVQaVJMTSoPSGXgmNIWAAUKi6ogAlDYrAB5RLAMCchZTUGnXgFQaUhpNMDIGD0xkQ2m6pkYFmZdn4FQSloUAB0OoZAFk4DIhZa7XqQELrUriaLRZS3UYhW1yhRRUA)

Poiché la property `children` appartiene all'interfaccia `Rec` necessitiamo solo di essa come upper bound del type parameter `R`. Esso è l'unico type parameter che ci interessa davvero, e TypeScript è in grado di inferirlo correttamente.
