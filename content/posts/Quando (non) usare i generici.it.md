+++
author = "Andrea Simone Costa"
title = "Quando (non) usare i generici"
date = "2023-06-05"
description = "Alcune linee guida per capire quando è il caso di usare i generici"
categories = ["typescript"]
series = ["TypeScript"]
published = false
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

Quando non viene effettivamente utilizzata. Seguono semplici esempi:

```ts
function add(n: number, m: number): number {
  const five = 5; // <- ???

  return n + m;
}
```
```ts
function add(n: number, m: number): number {
  const _n = n; // <- ???

  return n + m;
}
```
```ts
function add(n: number, m: number): number {
  const _n = n; // <- ???
  const _m = m; // <- ???
  const totalSum = _n + _m; // <- ?????

  return n + m;
}
```

## Quando non usare un generico

Indovina.

### Esempio 1

```ts
function len<T>(xs: readonly T[]): number {
  return xs.length;
}
```
Comprendo che la tentazione di flexare un generico sia forte in un caso come questo, ma tutto ciò non è molto diverso dal dichiarare una variabile, assegnare ad essa un valore per poi non usarla mai.\
Il generico `T` lo dichiariamo tra le parentesi angolate e utilizzandolo per tipare il parametro `xs` chiediamo a TypeScript di assegnarvi il tipo degli elementi di `xs` ogniqualvolta la funzione `len` viene invocata. Quello che manca, però, è almeno un "uso futuro" di tale tipo.

Possiamo riscrivere `len` nel seguente modo, senza utilizzare alcun generico:

```ts
function len(xs: readonly unknown[]): number {
  return xs.length;
}
```

### Esempio 2

```ts
function snd<A, B>(ab: [A, B]): B {
  return ab[1];
}
```
La funzione `snd` estrae il secondo elemento di una tupla. È perfettamente ragionevole voler far inferire a TypeScript il tipo di tale secondo elemento, in modo tale da poterlo restituire aumentando la precisione della segnatura della nostra funzione. Questo è un "uso futuro" di tutto rispetto. D'altra parte non vi è necessità di inferire anche il tipo del primo elemento. Il generico `A` verrà istanziato, ma mai utilizzato.

Possiamo riscrivere `snd` nel seguente modo, senza utilizzare il generico `A`:

```ts
function snd<B>(ab: [unknown, B]): B {
  return ab[1];
}
```

### Esempio 3

```ts
function printObjKey<T, K extends keyof T>(obj: T, key: K): void {
  console.log(obj[key]);
}
```

In questo caso stiamo dichiarando due variabili: una utile, l'altra inutile. Il nostro obiettivo è quello di assicurare che la chiave `key` scelta per indicizzare `obj` sia una chiave effettivamente presente in esso. Quindi chiediamo a TypeScript di inferire il tipo di `obj`, salvarlo nella variabile `T` e poi utilizziamo l'operatore `keyof` su `T` per calcolare le effettive chiavi di `obj` e limitare di conseguenza il tipo del secondo argomento `key`. Questo è l'"uso futuro" di `T`, l'"uso futuro" del tipo che sarà memorizzato al suo interno.\
La limitazione del tipo di `key` passa per un'altra variabile, `K`, il cui upper-bound è `keyof T`. Stiamo quindi chiedendo a TypeScript di inferire il tipo del secondo argomento, salvarlo nella variabile `K`, controllare che tale tipo sia assegnabile a `keyof T` e in caso contrario segnalare un errore. Della variabile `K`, però, non ce ne facciamo niente. Non è necessario salvare il tipo del secondo argomento in `K` poiché non vi è alcun "uso futuro" di tale tipo.

Possiamo riscrivere `printObjKey` nel seguente modo, senza utilizzare il generico `K`:

```ts
function printObjKey<T>(obj: T, key: keyof T): void {
  console.log(obj[key]);
}
```
