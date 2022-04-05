+++
author = "Andrea Simone Costa"
title = "Lookup types generici: come vivere felici anche senza l'analisi del control flow"
date = "2022-04-04"
description = "Come risolvere la mancanza di analisi del control flow quando si deve generare un valore il cui tipo è un lookup type generico"
categories = ["typescript"]
series = ["TypeScript"]
tags = [
    "types",
    "generics",
    "control flow analysis",
]
published = false
featuredImage = "/images/lookup-generici/generic_lookup.png"
images = ["/images/lookup-generici/generic_lookup.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

# Introduzione

La capacità di TypeScript di rifinire un tipo analizzando il control flow del codice è una delle feature più comode e utilizzate del linguaggio. Vediamo un semplice esempio per chiarire di che cosa si tratta:

```ts
function foo(x: string | number) {
  if(typeof x === "string") {
    console.log(x.repeat(x.length))
  } else {
    console.log(Math.sqrt(x))
  }
}
```

TypeScript è in grado di comprendere che se la condizione del costrutto `if` è verificata il tipo di `x` può essere correttamente "ristretto" al solo `string`: ecco che diventa possibile accedere al metodo `repeat` e alla proprietà `length` della stringa. Ciò ha come immediata conseguenza il fatto che nel ramo `else` la variabile `x` può solamente essere un `number`, quindi è possibile darlo in input a una delle utils esposte da `Math`.

# Il problema

TypeScript non supporta il narrowing di un type parameter `T` in base, ad esempio, al valore contenuto in una variabile avente quel tipo. In altre parole, l'analisi del control flow va quasi completamente a farsi benedire. Non dal papa, da Hejlsberg in persona. Questo perché è facilissimo ricadere in una situazione nella quale tale narrowing sarebbe scorretto, o _unsound_, come dicono gli inglesi.

Ecco che incontriamo dei problemi in situazioni come la seguente:
```ts
interface Payloads {
  auth: {
    username: string,
    password: string,
  },
  cart: {
    items: { id: string, quantity: number }[],
    price: number,
    appliedCoupon?: string
  },
  room: {
    id: string,
    name: string,
    partecipants: { username: string }[]
  }
}

function createPayload<K extends keyof Payloads>(service: K): Payloads[K] {
  switch(service) {
    case "auth": return { username: "johndoe", password: "eodnhoj" }
    case "cart": return { items: [], price: 0 }
    case "room": return { id: "123", name: "kitchen", partecipants: [{ username: "johndoe" }] }
  }
}
```

[Playgrounnd](https://www.typescriptlang.org/play?target=99&jsx=0#code/JYOwLgpgTgZghgYwgAgApwJ4BsD2cAmAzsgN4BQyycArmABYBcpFly1h0IcAthE4WCigA5gBoWlAA5xChAO44o+foJHjKAX3XIEcKGCblWyYJG6FDJ5cgFCQY5AEdqccKYxMQ1bgCNoyDQBtAF1tKSEkT28-KDCqSUksYAh8AGEcakkcEAB+FTthFi0WKBwcbkMJK3y1Kq5eGvs46X0IBGBpcAtSNg4oer4bVXsAkKKyDTIyGGoQBDBgbJ0oCDhIdGw8fAAeAGlkCAAPSBAiZABrCAwcGDRMXAJCAD4ACj6AN2BI5F2ASiYNg8iIFdsFmJR5KYEHQ3tBPkhfuDWLoOMgAEQ0ehopgrMDUfo9dicHiDNEAKxwdFOOAgaNEyGksgUSiYaIgOHwIDoODJaICVRRKDRun02OQuPxIB6pgg5iYIXpkgigwADPzjIL0aVymKJQSSNV0QBGABMAGY6cgBqzzlC6BAQJaWpB2p0wN1Agaif0SayKVT8DS+RowZNNBMgA)
