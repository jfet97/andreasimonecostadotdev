+++
author = "Andrea Simone Costa"
title = "Quando (non) usare i generici"
date = "2023-06-05"
published = false
description = "Alcune linee guida per capire quando è il caso di usare i generici"
categories = ["typescript"]
series = ["TypeScript"]
tags = [
    "generics",
]
featuredImage = "/images/usare_generici/copertina.png"
images = ["/images/usare_generici/copertina.png"]
+++

__Series__: [TypeScript](/it/series/typescript/)

## Introduzione

I generici, _type parameter_ per gli amici, sono una delle prime caratteristiche leggermente più astratte che si incrociano quando si utilizza un type system avente una maggiore espressività di quello del linguaggio C. È più che normale, specialmente per chi muove i primi passi, non avere ben chiaro quando è il caso di introdurne uno, o più di uno, e quando no.

In questo articolo affronteremo proprio questo problema. Cercheremo di capire meglio cosa sia un generico e valuteremo assieme alcune linee guida utili che ci possono aiutare a farne un buon uso. E a volte un buon uso corrisponde proprio a nessun uso.

## Cosa sono i generici

I generici sono variabili che contengono tipi. Siamo abituati a concepire le variabili come una astrazione di una locazione di memoria che conterrà dei valori durante l'esecuzione del programma. Si dà il caso che anche il compilatore sia un programma, il quale durante la fase di type checking inferisce, controlla ed effettua operazioni sui tipi. Un compilatore utilizza svariate strutture dati per rappresentare i tipi e manipolarli.\
I generici ci permettono di chiedere a TypeScript di inferire il tipo di una qualche entità e memorizzare tale tipo in una variabile. Come sia rappresentato internamente il tipo non è di nostro interesse, noi semplicemente vogliamo averlo a disposizione per usi futuri. Quando ad un generico viene assegnato un tipo si dice che il generico è stato _istanziato_.

L'esempio più semplice che mi viene in mente  per illustrare il concetto sono gli array:
```ts
const arr = [1, "ciao", 2]; //  (string | number)[]

const first = arr.pop(); // string | number | undefined

arr.push(false); // errore: 'false' è un boolean
```
La classe `Array` in TypeScript dichiara un generico per catturare il tipo del contenuto degli array. Quando creiamo un array, ad esempio con le parentesi quadre, stiamo implicitamente chiedendo a TypeScript di inferire il tipo degli elementi che inseriamo in esso e istanziare il generico dichiarato dalla classe `Array` opportunamente per quello specifico array. Nell'esempio il generico viene istanziato col tipo `string | number` per l'array `arr`. Quali sono gli usi futuri del tipo memorizzato nel generico? TypeScript lo utilizza per tipare al meglio le operazioni sull'array, come `push` e `pop`. La `pop` eseguita su `arr` restituisce infatti `string | number | undefined`, mentre la `push` non accetta argomenti aventi tipo differente da `string | number`.

Se il compilatore non disponesse dei generici dovrebbe assegnare il medesimo tipo ad ogni istanza di `Array`, e probabilmente tale tipo sarebbe qualcosa di equivalente ad `unknown[]`. Operazioni di lettura come la `pop` ci costringerebbero di volta in volta ad assertare - sennò poi venite a dirmi che in TypeScript non esistono cast, ma solo type assertion - il tipo del risultato. Operazioni di scrittura come la `push` invece accetterebbero la qualunque, con elevato rischio di inserire negli array valori inaspettati.

Assertare non si può sentire, ne sono consapevole.

## Quando non usare una variabile

Quando non viene utilizzata. Seguono semplici esempi:

```ts
function add(n: number, m: number): number {
  const five = 5;

  return n + m;
}
```
```ts
function add(n: number, m: number): number {
  const _n = n;

  return n + m;
}
```
```ts
function add(n: number, m: number): number {
  const _n = n;
  const _m = m;
  const totalSum = _n + _m;

  return n + m;
}
```