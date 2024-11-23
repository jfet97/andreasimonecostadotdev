+++
author = "Andrea Simone Costa"
title = "Una furbuffa divergenza tra type level e value level"
date = "2024-11-23"
description = "Discutiamo di una divergenza tra type level e value level in TypeScript quando si esegue l'accesso a una proprietà nel corpo di una funzione parametrica."
categories = ["typescript"]
series = ["TypeScript"]
tags = [
    "type level",
    "value level",
]
+++

## Il problema

Perché diamine l'accesso diretto alla proprietà `property` nel corpo della `access` è rotto male, mentre quello indiretto tramite la `get` funziona bene?

```ts
function get<O, K extends keyof O>(o: O, k: K) {
  return o[k]
}

function access<const T extends { property: unknown }>(to: T) {
  return {
    v1: to.property, // unknown :(
    v2: get(to, "property") // T["property"] :D
  }
}

const res = access({
  property: "hi there"
})

res
// ^? const res: { v1: unknown; v2: "hi there" }
```

[Playground](https://www.typescriptlang.org/play/#code/GYVwdgxgLglg9mABAcwKZQDwHkA0iDSiqAHlKmACYDOiA1qgJ5zCJYB8AFHAFyt6298ASkQBvAFCJEAJ3QhpSOAG1aAXXEBfceNCRYCRAEMIEVFSoYICKlEQAVIqXLUxiAA7S4b1NKgNe4LRgcADuSBqcUDz2IhJSslDySHFSiABuAIy8UQB0Hl4+fjiSqWkATLxoUBxReABE+d6+DHVCJVpa4lZgNjJmiAC8RiZmVBwpjYX+iHUAFjCIULM+qHWabeKyVOIA9DuIAHoA-EA)

&nbsp;

## Spiegazione

Quale è il tipo dell'accesso `to.property`? Dato che `to` ha tipo parametrico `T` allora è ragionevole aspettarsi che `to.property` abbia tipo `T['property']`. Ed è così sulla carta, solo che questo genere di accessi viene risolto da TypeScript prematuramente (_eagerly_) nel corpo della funzione, ovvero in un contesto in cui il type parameter `T` non è ancora noto. Questa è una scelta interna del compiler perché li mortacci loro.

Come viene risolto eagerly? TypeScript ha un po' le mani legate poiché `T` non è ancora noto, quindi sceglie di usare la constraint di `T` al suo posto. La constraint di `T` è `{ property: unknown }`, quindi TypeScript computa `{ property: unknown }['property']` che è esattamente `unknown`.

Ecco che `to.property` finisce per avere `unknown` come tipo anziché `T['property']`.

Nel caso dell'accesso indiretto tramite la `get` niente viene risolto eagerly. L'invocazione `get(to, "property")` restituisce il tipo `T['property']` e tale tipo non viene ulteriormente computato.

### Attenzione

C'è quindi una importante differenza tra ciò che succede nel __type level__ e ciò che succede nel __value level__ per quanto concerne l'accesso diretto ad una proprietà:

1. Nel __value level__ TypeScript risolve eagerly l'accesso diretto `to.property`, ed essendo il tipo di tale accesso `T['property']` il compiler si vede costretto a risolvere eagerly quest'ultimo, ma solo contestualmente all'espressione `to.property`.
2. Nel __type level__ `T['property']` di base rimane _deferred_. Nel resto del corpo della funzione TypeScript non risolve eagerly il tipo `T['property']`. Questo è il motivo per il quale la `get` può usarlo come tipo di ritorno e la type assertion `to.property as T['property']` risolve il problema.

### Un barbatrucco

Prendendo spunto dall'osservazione di [Simone Pizzamiglio](https://www.linkedin.com/feed/update/urn:li:activity:7266140760259874816?commentUrn=urn%3Ali%3Acomment%3A%28activity%3A7266140760259874816%2C7266155649187659778%29&dashCommentUrn=urn%3Ali%3Afsd_comment%3A%287266155649187659778%2Curn%3Ali%3Aactivity%3A7266140760259874816%29), si potrebbe tentare di fregare il compilatore usando `{ property: T['property'] }` come constraint per `T` al posto di `{ property:  unknown }`:

```ts
function access<const T extends { property: T['property'] }>(to: T) {
  return {
    v1: to.property, // T["property"] :D
    v2: get(to, "property") // T["property"] :D
  }
}
```

[Playground](https://www.typescriptlang.org/play/?#code/GYVwdgxgLglg9mABAcwKZQDwHkA0iDSiqAHlKmACYDOiA1qgJ5zCJYB8AFHAFyt6298ASkQBvAFCJEAJ3QhpSOAG1aAXXEBfceNCRYCRAEMIEVFSoYICKlEQAVIqXLUxiAA7S4b1NKgNedkoA5B5ePn5BqoganFA89iISUrJQ8khJUogAbgCMvHEAdKHevgw4kplZAEy8aFAccXgARMXhDE1CFVpa4lZgNjJmiAC8RiZmVBwZraW8TQAWMIhQ8z6oTZqd4rJU4gD0e4gAegD8QA)

 Quando TypeScript andrà a sostituire la constraint di `T` al posto di `T` per risolvere eagerly `T['property']` si troverà a computare `{ property: T['property'] }['property']`, che è proprio pari a `T['property']`! Per fortuna TypeScript non si accorge di essere tornato al punto di partenza, altrimenti proverebbe nuovamente a computare eagerly `T['property']` e si ritroverebbe in un loop infinito.

 Un evidente limite di questo barbatrucco risiede nell'impossibilità di impostare agevolmente una constraint diversa da `unknown` per la key `property`. Si potrebbe pensare ad una soluzione come la seguente, dove ogni key viene intersecata alla constraint corrispondente:

 ```ts
function foo<T extends { 
    bar: T['bar'] & ConstraintForBar,
    baz: T['baz'] & ConstraintForBaz,
    // ...
}>(to: T) {
  // ...
}
 ```

Purtroppo se una o più key constraint fossero un tipo oggetto anziché un tipo plain come `number` o `string` la constraint risultante per `T` potrebbe non essere affatto quella preventivata.

&nbsp;

## Referenze

> Note that for a generic `T` and a non-generic `K`, we eagerly resolve `T[K]` if it originates in an expression. This is to preserve backwards compatibility.

— Linee 19035, 19036 e 19037 @ `checker.ts`, commit `d85767abfd83880cea17cea70f9913e9c4496dcc`.
